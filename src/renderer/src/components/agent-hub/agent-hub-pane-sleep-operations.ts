import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { runtimeEnvironmentSupportsCapability } from '@/runtime/rpc/compatibility/runtime-capability-proof'
import { AGENT_HUB_MANUAL_PANE_SLEEP_CAPABILITY } from '../../../../shared/agent-hub-capabilities'
import { parsePaneKey, makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { collectSleepingAgentSessionRecordsForWorktree } from '@/store/slices/agent-status/agent-status-recovery-collection'
import { resolveWorkspaceTerminalHostAuthority } from '@/lib/workspace/ownership/workspace-terminal-host-authority'
import { resolveTerminalPtyOwner } from '@/lib/terminal-worktree-route'
import { runtimeEnvironmentIdOrLocalUnlessTwin } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { toAgentHibernationRuntimeOwner } from '@/lib/agent-session/hibernation/agent-hibernation-runtime-owner'
import { toRuntimePtyId } from '@/lib/agent-session/hibernation/agent-hibernation-pane-eligibility'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/background-terminal-worktree-mount'
import {
  getPaneSpawnDeferral,
  subscribePaneSpawnDeferrals
} from '@/lib/pane-spawn-deferral-registry'
import { WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT } from '@/constants/terminal'
import { resolveAgentHubPtyId, type AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  changeAgentHubTerminalSuspension,
  readAgentHubTerminalSuspension
} from './agent-hub-terminal-suspension'

export function agentHubSleepPaneKey(target: AgentHubPaneTarget): string | null {
  if (target.paneKey) {
    return target.paneKey
  }
  const leaf = useAppStore.getState().terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  return leaf ? makePaneKey(target.tab.id, leaf) : null
}

const MANUAL_SLEEP_HOST_UPDATE_REASON =
  'Update Orca on the execution host before using manual pane sleep.'

/** The disabled reason once a remote execution host is known to lack manual pane sleep. */
export function useAgentHubManualSleepHostReason(target: AgentHubPaneTarget): string | undefined {
  const environmentId = useAppStore((state) => {
    if (!target.agentType) {
      return null
    }
    return runtimeEnvironmentIdOrLocalUnlessTwin(state, target.worktree.id)
  })
  const [unsupported, setUnsupported] = useState<string | null>(null)
  useEffect(() => {
    if (!environmentId) {
      return
    }
    let cancelled = false
    void runtimeEnvironmentSupportsCapability(
      environmentId,
      AGENT_HUB_MANUAL_PANE_SLEEP_CAPABILITY
    ).then(
      (supported) => {
        if (!cancelled) {
          setUnsupported(supported ? null : environmentId)
        }
      },
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [environmentId])
  return environmentId && unsupported === environmentId
    ? MANUAL_SLEEP_HOST_UPDATE_REASON
    : undefined
}

export function agentHubPaneSleepReason(target: AgentHubPaneTarget): string | undefined {
  const state = useAppStore.getState()
  if (resolveWorkspaceTerminalHostAuthority(state, target.worktree.id) === 'unverifiable') {
    return 'The execution host cannot verify this terminal. Reconnect before sleeping it.'
  }
  const paneKey = agentHubSleepPaneKey(target)
  if (!paneKey || !resolveAgentHubPtyId(state, target.tab.id, paneKey)) {
    return 'This pane has no verified running terminal.'
  }
  if (!target.agentType) {
    const suspension = readAgentHubTerminalSuspension(target)
    return suspension?.state === 'awake' && suspension.incarnationId
      ? undefined
      : suspension?.state === 'unsupported'
        ? 'This execution host does not support terminal suspension.'
        : 'Terminal suspension could not be verified on its execution host.'
  }
  const records = collectSleepingAgentSessionRecordsForWorktree(state, target.worktree.id, {
    paneKeys: [paneKey],
    captureMode: 'manual-worktree-sleep'
  })
  if (!records[paneKey]) {
    return 'This agent has not provided a resumable session checkpoint.'
  }
  return undefined
}

export async function sleepAgentHubPane(target: AgentHubPaneTarget): Promise<void> {
  const reason = agentHubPaneSleepReason(target)
  if (reason) {
    throw new Error(reason)
  }
  if (!target.agentType) {
    const result = await changeAgentHubTerminalSuspension(target, true)
    if (result.state === 'unsupported') {
      throw new Error(
        'This execution host does not support terminal suspension. Update Orca there.'
      )
    }
    if (result.state !== 'suspended') {
      throw new Error(
        'Terminal suspension could not be verified. Recheck the execution host before retrying.'
      )
    }
    return
  }
  const state = useAppStore.getState()
  const paneKey = agentHubSleepPaneKey(target)
  const pane = paneKey ? parsePaneKey(paneKey) : null
  const ptyId = paneKey ? resolveAgentHubPtyId(state, target.tab.id, paneKey) : null
  if (!paneKey || !pane || !ptyId) {
    throw new Error('The selected pane changed. Try again.')
  }
  const owner = toAgentHibernationRuntimeOwner(resolveTerminalPtyOwner(state, target.worktree.id), [
    ptyId
  ])
  if (owner.kind === 'unresolved') {
    throw new Error('The execution host is unverifiable.')
  }
  // An old host may discard the optional wake-only field and automatically restart the agent.
  if (
    owner.kind === 'runtime' &&
    !(await runtimeEnvironmentSupportsCapability(
      owner.environmentId,
      AGENT_HUB_MANUAL_PANE_SLEEP_CAPABILITY
    ))
  ) {
    throw new Error(MANUAL_SLEEP_HOST_UPDATE_REASON)
  }
  await state.shutdownCompletedAgentPaneForHibernation(target.worktree.id, {
    paneKey,
    tabId: target.tab.id,
    leafId: pane.leafId,
    ptyId,
    manual: true,
    ...(owner.kind === 'runtime' ? { expectedRuntimePtyId: toRuntimePtyId(ptyId) } : {})
  })
}

export async function wakeAgentHubPane(target: AgentHubPaneTarget): Promise<void> {
  if (!target.agentType) {
    const result = await changeAgentHubTerminalSuspension(target, false)
    if (result.state !== 'awake') {
      throw new Error('Terminal wake could not be verified on the execution host.')
    }
    return
  }
  const state = useAppStore.getState()
  if (resolveWorkspaceTerminalHostAuthority(state, target.worktree.id) === 'unverifiable') {
    throw new Error('The execution host is unverifiable. Reconnect before waking this pane.')
  }
  const paneKey = agentHubSleepPaneKey(target)
  if (!paneKey || !state.sleepingAgentSessionsByPaneKey[paneKey]) {
    throw new Error('This pane no longer has a saved session.')
  }
  const claims = new Set<string>()
  window.dispatchEvent(
    new CustomEvent(WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT, {
      detail: { worktreeId: target.worktree.id, paneKey, wokenClaimKeys: claims }
    })
  )
  requestBackgroundTerminalWorktreeMount({
    worktreeId: target.worktree.id,
    tabIds: [target.tab.id]
  })
  await new Promise<void>((resolve, reject) => {
    let requested = claims.size > 0
    let stopped = false
    let unsubscribeState = () => {}
    let unsubscribeDeferral = () => {}
    const finish = (error?: Error): void => {
      if (stopped) {
        return
      }
      stopped = true
      clearTimeout(timer)
      unsubscribeState()
      unsubscribeDeferral()
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    const check = (): void => {
      if (stopped) {
        return
      }
      const current = useAppStore.getState()
      if (!current.tabsByWorktree[target.worktree.id]?.some((tab) => tab.id === target.tab.id)) {
        finish(new Error('The selected tab was closed.'))
      } else if (
        !current.sleepingAgentSessionsByPaneKey[paneKey] &&
        resolveAgentHubPtyId(current, target.tab.id, paneKey)
      ) {
        finish()
      } else {
        const deferral = getPaneSpawnDeferral(paneKey)
        if (deferral && !requested) {
          requested = true
          deferral.resume()
        }
      }
    }
    const timer = setTimeout(
      () => finish(new Error('Wake could not be verified. The saved session is retained.')),
      15_000
    )
    unsubscribeState = useAppStore.subscribe(check)
    unsubscribeDeferral = subscribePaneSpawnDeferrals(check)
    check()
  })
}
