import type { AgentHubPane } from '../../../../shared/agent-hub-requests'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { parseRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import type { Worktree } from '../../../../shared/worktree/types'
import type { AppState } from '@/store/types'
import { resolveWorktreeOperationRoute } from '@/lib/workspace/ownership/worktree-operation-route'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'
import {
  paneTargetFromThread,
  paneTargetFromTerminalRow,
  resolveAgentHubPtyId,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { agentHubMirrorPaneExists } from './agent-hub-mirror-source'

export function agentHubRequestHost(state: AppState, worktree: Worktree): string | null {
  if (worktree.runtimeOwnerEnvironmentId) {
    return worktree.runtimeOwnerEnvironmentId
  }
  if (worktree.hostId === 'local' || worktree.hostId?.startsWith('ssh:')) {
    return 'local'
  }
  const route = resolveWorktreeOperationRoute(state, worktree.id)
  if (route?.runtimeEnvironmentId) {
    return route.runtimeEnvironmentId
  }
  if (worktree.hostId?.startsWith('runtime:')) {
    return null
  }
  return route?.executionHostId ? 'local' : null
}

export function agentHubTargetPane(
  state: AppState,
  target: AgentHubPaneTarget
): AgentHubPane | null {
  const pty = resolveAgentHubPtyId(state, target.tab.id, target.paneKey)
  const leaf = state.terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  const paneKey = target.paneKey ?? (leaf ? `${target.tab.id}:${leaf}` : null)
  return pty && paneKey
    ? { paneKey, terminalHandle: parseRemoteRuntimePtyId(pty)?.handle ?? pty }
    : null
}

export function findAgentHubRequestTarget(
  state: AppState,
  threads: readonly AgentPaneThread[],
  host: string,
  pane: AgentHubPane
): AgentHubPaneTarget | null {
  const matches = (target: AgentHubPaneTarget): boolean => {
    if (agentHubRequestHost(state, target.worktree) !== host) {
      return false
    }
    const live = agentHubTargetPane(state, target)
    return (
      target.paneKey === pane.paneKey ||
      live?.paneKey === pane.paneKey ||
      live?.terminalHandle === pane.terminalHandle
    )
  }
  for (const thread of threads) {
    const target = paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle)
    if (matches(target)) {
      return target
    }
  }
  const findRow = (rows: readonly AgentHubTerminalRow[]): AgentHubPaneTarget | null => {
    for (const row of rows) {
      const target = paneTargetFromTerminalRow(row)
      if (
        agentHubRequestHost(state, target.worktree) === host &&
        parsePaneKey(pane.paneKey)?.tabId === target.tab.id &&
        agentHubMirrorPaneExists(state, target.tab.id, pane.paneKey)
      ) {
        return { ...target, paneKey: pane.paneKey }
      }
      if (matches(target)) {
        return { ...target, paneKey: pane.paneKey }
      }
      const child = findRow(row.children)
      if (child) {
        return child
      }
    }
    return null
  }
  for (const group of agentHubTerminalTreeFromState(state, threads, true, new Map())) {
    for (const workspace of group.workspaces) {
      const found = findRow(workspace.rows)
      if (found) {
        return found
      }
    }
  }
  return null
}
