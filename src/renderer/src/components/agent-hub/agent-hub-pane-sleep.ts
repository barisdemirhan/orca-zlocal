import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'
import { agentHubRowOfTab } from './agent-hub-tab-row'
import {
  paneTargetFromTerminalRow,
  resolveAgentHubPtyId,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { resolveWorkspaceTerminalHostAuthority } from '@/lib/workspace/ownership/workspace-terminal-host-authority'
import {
  agentHubSleepPaneKey,
  agentHubPaneSleepReason,
  sleepAgentHubPane,
  wakeAgentHubPane
} from './agent-hub-pane-sleep-operations'
import {
  readAgentHubTerminalSuspension,
  changeAgentHubTerminalSuspension,
  useAgentHubTerminalSuspension,
  useAgentHubTerminalSuspensionTest
} from './agent-hub-terminal-suspension'

export type AgentHubPaneSleepPhase =
  | 'awake'
  | 'sleeping'
  | 'sleeping-pending'
  | 'waking'
  | 'unverifiable'
// 'failed' keeps a precondition error without overriding the derived awake/sleeping phase.
type Operation = {
  phase: 'sleeping-pending' | 'waking' | 'unverifiable' | 'failed'
  error?: string
}
const isHostConfirmationFailure = (message: string): boolean =>
  /unverifiable|could not be verified/i.test(message)
const operations = new Map<string, Operation>()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const notify = (): void => {
  for (const listener of listeners) {
    listener()
  }
}
const keyFor = (target: AgentHubPaneTarget): string =>
  `${getWorktreeHostIdentity(target.worktree)}\u0000${agentHubSleepPaneKey(target) ?? target.tab.id}`

export function isAgentHubTargetSleeping(target: AgentHubPaneTarget): boolean {
  if (!target.agentType && readAgentHubTerminalSuspension(target)?.state === 'suspended') {
    return true
  }
  const state = useAppStore.getState()
  const paneKey = agentHubSleepPaneKey(target)
  const record = paneKey ? state.sleepingAgentSessionsByPaneKey[paneKey] : undefined
  return Boolean(
    record &&
    record.worktreeId === target.worktree.id &&
    (record.origin !== 'live' || record.wakeOnRequestOnly) &&
    !resolveAgentHubPtyId(state, target.tab.id, paneKey)
  )
}

export function useAgentHubSleepingTargetTest(): (target: AgentHubPaneTarget) => boolean {
  const terminalSleeping = useAgentHubTerminalSuspensionTest()
  const records = useAppStore((state) => state.sleepingAgentSessionsByPaneKey)
  const ptys = useAppStore((state) => state.ptyIdsByTabId)
  const layouts = useAppStore((state) => state.terminalLayoutsByTabId)
  return useMemo(() => {
    return (target: AgentHubPaneTarget) => {
      if (!target.agentType && terminalSleeping(target)) {
        return true
      }
      const leaf = layouts[target.tab.id]?.activeLeafId
      const paneKey = target.paneKey ?? (leaf ? makePaneKey(target.tab.id, leaf) : null)
      const record = paneKey ? records[paneKey] : undefined
      return Boolean(
        record &&
        record.worktreeId === target.worktree.id &&
        (record.origin !== 'live' || record.wakeOnRequestOnly) &&
        !resolveAgentHubPtyId(
          { ptyIdsByTabId: ptys, terminalLayoutsByTabId: layouts },
          target.tab.id,
          paneKey
        )
      )
    }
  }, [records, ptys, layouts, terminalSleeping])
}

async function runOperation(target: AgentHubPaneTarget, wake: boolean): Promise<void> {
  const key = keyFor(target)
  const previous = operations.get(key)
  if (previous?.phase === 'sleeping-pending' || previous?.phase === 'waking') {
    return
  }
  operations.set(key, { phase: wake ? 'waking' : 'sleeping-pending' })
  notify()
  try {
    await (wake ? wakeAgentHubPane(target) : sleepAgentHubPane(target))
    operations.delete(key)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The operation could not be verified.'
    operations.set(key, {
      phase: isHostConfirmationFailure(message) ? 'unverifiable' : 'failed',
      error: message
    })
    throw error
  } finally {
    notify()
  }
}

export function useAgentHubPaneSleep(target: AgentHubPaneTarget) {
  const key = keyFor(target)
  const operation = useSyncExternalStore(subscribe, () => operations.get(key))
  useAgentHubTerminalSuspension(target)
  const sleepingTest = useAgentHubSleepingTargetTest()
  const paneKey = agentHubSleepPaneKey(target)
  useAppStore((state) => (paneKey ? state.agentStatusByPaneKey.get(paneKey) : undefined))
  const sleeping = sleepingTest(target)
  const unverifiable = useAppStore(
    (state) => resolveWorkspaceTerminalHostAuthority(state, target.worktree.id) === 'unverifiable'
  )
  const settledPhase = operation?.phase === 'failed' ? undefined : operation?.phase
  const phase: AgentHubPaneSleepPhase =
    settledPhase ?? (unverifiable ? 'unverifiable' : sleeping ? 'sleeping' : 'awake')
  const reason = sleeping ? undefined : agentHubPaneSleepReason(target)
  return {
    phase,
    kind: target.agentType ? ('agent' as const) : ('terminal' as const),
    canSleep:
      !reason &&
      operation?.phase !== 'sleeping-pending' &&
      operation?.phase !== 'waking' &&
      !sleeping,
    reason,
    error: operation?.error,
    sleep: useCallback(() => runOperation(target, false), [target]),
    wake: useCallback(() => runOperation(target, true), [target]),
    recheck: useCallback(async () => {
      if (!target.agentType) {
        await changeAgentHubTerminalSuspension(target)
      }
      operations.delete(key)
      notify()
    }, [key, target])
  }
}

export function useAgentHubPaneTarget(
  worktreeId: string,
  tabId: string,
  paneKey: string
): AgentHubPaneTarget | null {
  const worktrees = useAppStore((state) => state.worktreesByRepo)
  const folders = useAppStore((state) => state.folderWorkspaces)
  const repos = useAppStore((state) => state.repos)
  const tabs = useAppStore((state) => state.tabsByWorktree[worktreeId])
  const entry = useAppStore((state) => state.agentStatusByPaneKey.get(paneKey))
  const record = useAppStore((state) => state.sleepingAgentSessionsByPaneKey[paneKey])
  return useMemo(() => {
    const row = agentHubRowOfTab(
      agentHubTerminalTreeFromState(
        {
          ...useAppStore.getState(),
          worktreesByRepo: worktrees,
          folderWorkspaces: folders,
          repos,
          tabsByWorktree: { ...useAppStore.getState().tabsByWorktree, [worktreeId]: tabs ?? [] }
        },
        [],
        true,
        new Map()
      ),
      tabId
    )
    if (!row || row.worktree.id !== worktreeId) {
      return null
    }
    const target = paneTargetFromTerminalRow(row)
    return { ...target, paneKey, agentType: entry?.agentType ?? record?.agent ?? target.agentType }
  }, [worktreeId, tabId, paneKey, worktrees, folders, repos, tabs, entry, record])
}
