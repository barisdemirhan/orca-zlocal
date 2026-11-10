import { create } from 'zustand'
import { useCallback, useEffect } from 'react'
import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import type { TerminalSuspensionResult } from '../../../../shared/terminal-suspension'
import { resolveAgentHubTargetTerminal } from './agent-hub-target-terminal'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { resolveAgentHubPtyId, type AgentHubPaneTarget } from './agent-hub-pane-target'

const useSuspensions = create<{ entries: ReadonlyMap<string, TerminalSuspensionResult> }>(() => ({
  entries: new Map()
}))
const pending = new Map<string, Promise<TerminalSuspensionResult>>()
function keyFor(target: AgentHubPaneTarget): string {
  const ptyId = resolveAgentHubPtyId(useAppStore.getState(), target.tab.id, target.paneKey)
  const leaf = useAppStore.getState().terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  return JSON.stringify([
    getWorktreeHostIdentity(target.worktree),
    target.tab.id,
    target.paneKey ?? leaf,
    ptyId
  ])
}
export const readAgentHubTerminalSuspension = (
  target: AgentHubPaneTarget
): TerminalSuspensionResult | undefined => useSuspensions.getState().entries.get(keyFor(target))

export async function changeAgentHubTerminalSuspension(
  target: AgentHubPaneTarget,
  suspended?: boolean
): Promise<TerminalSuspensionResult> {
  const state = useAppStore.getState()
  const ptyId = resolveAgentHubPtyId(state, target.tab.id, target.paneKey)
  if (!ptyId) {
    return { state: 'unverifiable' }
  }
  const key = keyFor(target)
  const cached = readAgentHubTerminalSuspension(target)
  let result: TerminalSuspensionResult
  try {
    const { transport, terminal } = await resolveAgentHubTargetTerminal(target, ptyId)
    result = await callRuntimeRpc<TerminalSuspensionResult>(
      transport,
      'terminal.suspension',
      {
        terminal,
        ...(suspended !== undefined
          ? { suspended, expectedIncarnationId: cached?.incarnationId }
          : {})
      },
      { timeoutMs: 7_000 }
    )
  } catch (error) {
    // An older host lacks terminal.suspension; that is a capability gap, not lost contact.
    result = hasRuntimeRpcErrorCode(error, 'method_not_found')
      ? { state: 'unsupported' }
      : { state: 'unverifiable' }
  }
  if (resolveAgentHubPtyId(useAppStore.getState(), target.tab.id, target.paneKey) === ptyId) {
    useSuspensions.setState((current) => ({ entries: new Map(current.entries).set(key, result) }))
  }
  return result
}

export function useAgentHubTerminalSuspension(
  target: AgentHubPaneTarget
): TerminalSuspensionResult | undefined {
  const key = keyFor(target)
  const entry = useSuspensions((state) => state.entries.get(key))
  useEffect(() => {
    if (target.agentType || entry) {
      return
    }
    if (!pending.has(key)) {
      const request = changeAgentHubTerminalSuspension(target).finally(() => pending.delete(key))
      pending.set(key, request)
    }
  }, [key, target, entry])
  return entry
}

export function useAgentHubTerminalSuspensionTest(): (target: AgentHubPaneTarget) => boolean {
  const entries = useSuspensions((state) => state.entries)
  return useCallback(
    (target: AgentHubPaneTarget) => entries.get(keyFor(target))?.state === 'suspended',
    [entries]
  )
}
