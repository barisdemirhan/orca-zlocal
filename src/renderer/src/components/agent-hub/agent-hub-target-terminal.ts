import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { resolveTerminalPtyOwner } from '@/lib/workspace/ownership/terminal-worktree-route'
import { toAgentHibernationRuntimeOwner } from '@/lib/agent-session/hibernation/agent-hibernation-runtime-owner'
import type { RuntimeTerminalResolvePane } from '../../../../shared/runtime-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import {
  isRemoteRuntimePtyId,
  parseRemoteRuntimePtyId
} from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import { resolveAgentHubPtyId, type AgentHubPaneTarget } from './agent-hub-pane-target'

/** Resolve a host handle without letting a replaced pane inherit the selected process. */
export async function resolveAgentHubTargetTerminal(
  target: AgentHubPaneTarget,
  expectedPtyId: string
): Promise<{ transport: RuntimeClientTarget; terminal: string }> {
  const state = useAppStore.getState()
  const owner = toAgentHibernationRuntimeOwner(resolveTerminalPtyOwner(state, target.worktree.id), [
    expectedPtyId
  ])
  if (
    owner.kind === 'unresolved' ||
    resolveAgentHubPtyId(state, target.tab.id, target.paneKey) !== expectedPtyId
  ) {
    throw new Error('The selected terminal is unverifiable.')
  }
  const transport: RuntimeClientTarget =
    owner.kind === 'runtime'
      ? { kind: 'environment', environmentId: owner.environmentId }
      : { kind: 'local' }
  const remote = parseRemoteRuntimePtyId(expectedPtyId)
  if (isRemoteRuntimePtyId(expectedPtyId) && !remote) {
    throw new Error('The selected execution host is unverifiable.')
  }
  if (remote) {
    if (owner.kind !== 'runtime' || remote.environmentId !== owner.environmentId) {
      throw new Error('The selected execution host changed.')
    }
    return { transport, terminal: remote.handle }
  }
  const leaf = state.terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  const paneKey = target.paneKey ?? (leaf ? makePaneKey(target.tab.id, leaf) : null)
  if (!paneKey) {
    throw new Error('The selected pane has no terminal address.')
  }
  const resolved = await callRuntimeRpc<{ terminal: RuntimeTerminalResolvePane }>(
    transport,
    'terminal.resolvePane',
    { paneKey, worktreeId: target.worktree.id },
    { timeoutMs: 7_000 }
  )
  if (
    resolved.terminal.ptyId !== expectedPtyId ||
    resolveAgentHubPtyId(useAppStore.getState(), target.tab.id, target.paneKey) !== expectedPtyId
  ) {
    throw new Error('The selected terminal changed.')
  }
  return { transport, terminal: resolved.terminal.handle }
}
