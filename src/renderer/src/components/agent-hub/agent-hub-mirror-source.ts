import {
  agentHubMirrorWindows,
  homeAgentHubMirrorTab,
  removeAgentHubMirrorEntries,
  replaceAgentHubMirrorWindow,
  type AgentHubMirrorState,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { runtimeHostConnectionStateForEntry } from '@/runtime/hosts/connections/runtime-host-connection-state'
import { selectRuntimeAwareSshStatus } from '@/store/slices/ssh/runtime-environment-ssh-selectors'
import { parseExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { folderWorkspaceToWorktree } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import {
  getExecutionHostIdFromWorktreeHostIdentity,
  getWorktreeHostIdentity
} from '../../../../shared/worktree/host-qualified-identity'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { collectLayoutLeafIdsInOrder } from '../../../../shared/workspace-layout/terminal-topology/terminal-pane-tree'
import { agentHubTabsByWorktree, isAgentHubChatTab } from './agent-hub-chat-tabs'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

type SourceState = Parameters<typeof agentHubTerminalTreeFromState>[0] &
  Partial<
    Pick<AppState, 'sshConnectionStates' | 'sshStateByEnvironment' | 'runtimeStatusByEnvironmentId'>
  >
const NO_PARENTS: ReadonlyMap<string, string> = new Map()

export function findAgentHubMirrorSource(
  state: SourceState,
  reference: { worktreeId: string; tabId: string; hostIdentity: string | null }
): AgentHubTerminalRow | null {
  const hostId =
    reference.hostIdentity === null
      ? undefined
      : getExecutionHostIdFromWorktreeHostIdentity(reference.hostIdentity)
  const matches: AgentHubTerminalRow[] = []
  const find = (rows: readonly AgentHubTerminalRow[]): void => {
    for (const row of rows) {
      if (
        row.tab.id === reference.tabId &&
        (reference.hostIdentity === null
          ? row.worktree.id === reference.worktreeId
          : row.worktree.hostId === hostId)
      ) {
        matches.push(row)
      }
      find(row.children)
    }
  }
  for (const group of agentHubTerminalTreeFromState(state, [], true, NO_PARENTS)) {
    for (const workspace of group.workspaces) {
      find(workspace.rows)
    }
  }
  // A v1 reference has no host; never restore it into an arbitrarily chosen execution host.
  const exact = matches.filter((row) => row.worktree.id === reference.worktreeId)
  const candidates = exact.length ? exact : hostId ? matches : []
  const owners = new Set(candidates.map((row) => getWorktreeHostIdentity(row.worktree)))
  return owners.size === 1 ? (candidates[0] ?? null) : null
}

export function agentHubMirrorPaneExists(
  state: SourceState,
  tabId: string,
  paneKey: string
): boolean {
  // A chat is one pane with no terminal layout; it lasts as long as its tab.
  if (isAgentHubChatTab(state, tabId)) {
    return true
  }
  const parsed = parsePaneKey(paneKey)
  const layout = state.terminalLayoutsByTabId[tabId]
  return Boolean(
    layout &&
    parsed?.tabId === tabId &&
    (layout.activeLeafId === parsed.leafId ||
      collectLayoutLeafIdsInOrder(layout.root).includes(parsed.leafId) ||
      Object.hasOwn(layout.ptyIdsByLeafId ?? {}, parsed.leafId))
  )
}

/** The leaf a shell mirror shows: the tab's active leaf, or an existing one if that leaf closed. */
export function agentHubMirrorShellLeafId(
  layout: SourceState['terminalLayoutsByTabId'][string] | undefined
): string | null {
  if (!layout) {
    return null
  }
  const leafIds = collectLayoutLeafIdsInOrder(layout.root)
  if (leafIds.length === 0 || (layout.activeLeafId && leafIds.includes(layout.activeLeafId))) {
    return layout.activeLeafId
  }
  return leafIds[0] ?? null
}

function sourceHostConnected(state: SourceState, target: AgentHubPaneTarget): boolean {
  const host = parseExecutionHostId(target.worktree.hostId)
  if (host?.kind === 'local') {
    return true
  }
  const environmentId =
    host?.kind === 'runtime' ? host.environmentId : target.worktree.runtimeOwnerEnvironmentId
  if (
    environmentId &&
    runtimeHostConnectionStateForEntry(state.runtimeStatusByEnvironmentId?.get(environmentId)) !==
      'connected'
  ) {
    return false
  }
  if (host?.kind === 'runtime') {
    return true
  }
  return (
    host?.kind === 'ssh' &&
    selectRuntimeAwareSshStatus(
      {
        ...state,
        sshConnectionStates: state.sshConnectionStates ?? new Map(),
        sshStateByEnvironment: state.sshStateByEnvironment ?? new Map()
      },
      environmentId ?? null,
      host.targetId
    ) === 'connected'
  )
}

/** A missing source is closed only while its execution host can verify the inventory. */
export function isAgentHubMirrorSourceClosed(
  state: SourceState,
  target: AgentHubPaneTarget
): boolean {
  const workspaces = [
    ...Object.values(state.worktreesByRepo).flat(),
    ...state.folderWorkspaces.map(folderWorkspaceToWorktree)
  ]
  const owners = workspaces.filter((workspace) => workspace.id === target.worktree.id)
  if (target.worktree.hostId && !owners.some((owner) => owner.hostId === target.worktree.hostId)) {
    return (
      sourceHostConnected(state, target) &&
      !findAgentHubMirrorSource(state, {
        worktreeId: target.worktree.id,
        tabId: target.tab.id,
        hostIdentity: getWorktreeHostIdentity(target.worktree)
      })
    )
  }
  // Unqualified tab/layout maps cannot prove closure using another host's inventory.
  if (owners.some((owner) => owner.hostId !== target.worktree.hostId)) {
    return false
  }
  const tabsByWorktree = agentHubTabsByWorktree(state)
  const currentTabs = tabsByWorktree[target.worktree.id]
  const moved = currentTabs?.some((tab) => tab.id === target.tab.id)
    ? null
    : findAgentHubMirrorSource(state, {
        worktreeId: target.worktree.id,
        tabId: target.tab.id,
        hostIdentity: getWorktreeHostIdentity(target.worktree)
      })
  const tabs = moved ? tabsByWorktree[moved.worktree.id] : currentTabs
  if (!tabs) {
    // A loaded workspace keeps its unified bucket after its last tab (often a chat) closes.
    const unified = state.unifiedTabsByWorktree?.[target.worktree.id]
    return Boolean(unified?.every((tab) => tab.id !== target.tab.id))
  }
  if (!tabs.some((tab) => tab.id === target.tab.id)) {
    return true
  }
  if (
    workspaces.some(
      (workspace) =>
        workspace.hostId !== target.worktree.hostId &&
        tabsByWorktree[workspace.id]?.some((tab) => tab.id === target.tab.id)
    )
  ) {
    return false
  }
  return Boolean(
    target.paneKey &&
    state.terminalLayoutsByTabId[target.tab.id] &&
    !agentHubMirrorPaneExists(state, target.tab.id, target.paneKey)
  )
}

/** Re-read labels and source ownership immediately before committing membership changes. */
export function resolveAgentHubMirrorTarget(target: AgentHubPaneTarget): AgentHubPaneTarget | null {
  const state = useAppStore.getState()
  const row = findAgentHubMirrorSource(state, {
    worktreeId: target.worktree.id,
    tabId: target.tab.id,
    hostIdentity: getWorktreeHostIdentity(target.worktree)
  })
  if (!row || (target.paneKey && !agentHubMirrorPaneExists(state, row.tab.id, target.paneKey))) {
    return null
  }
  return { ...target, worktree: row.worktree, repo: row.repo, tab: row.tab }
}

export function reconcileAgentHubMirrorSources(state: AgentHubMirrorState): AgentHubMirrorState {
  const app = useAppStore.getState()
  let next = removeAgentHubMirrorEntries(state, (target) =>
    isAgentHubMirrorSourceClosed(app, target)
  )
  for (const window of agentHubMirrorWindows(next)) {
    const refresh = (target: AgentHubPaneTarget): AgentHubPaneTarget => {
      if (app.tabsByWorktree[target.worktree.id]?.some((tab) => tab.id === target.tab.id)) {
        return target
      }
      const resolved = resolveAgentHubMirrorTarget(target)
      return resolved && resolved.worktree.id !== target.worktree.id ? resolved : target
    }
    const tabs = window.tabs.map((tab) => {
      const target = refresh(tab.target)
      const viewing = tab.viewing ? refresh(tab.viewing) : undefined
      return target !== tab.target || viewing !== tab.viewing ? { ...tab, target, viewing } : tab
    })
    if (tabs.some((tab, index) => tab !== window.tabs[index])) {
      next = replaceAgentHubMirrorWindow(next, window.id, { ...window, tabs })
    }
  }
  return next
}

export function resolveAgentHubMirrorWindow(
  window: AgentHubMirrorWindowState,
  resolveTarget = resolveAgentHubMirrorTarget
): AgentHubMirrorWindowState | null {
  const tabs = window.tabs.flatMap((tab) => {
    const target =
      resolveTarget(tab.target) ??
      (isAgentHubMirrorSourceClosed(useAppStore.getState(), tab.target) ? null : tab.target)
    const viewing = tab.viewing ? resolveTarget(tab.viewing) : null
    return target
      ? [
          {
            ...homeAgentHubMirrorTab(tab),
            target,
            ...(viewing ? { viewing } : {}),
            origin: 'manual' as const
          }
        ]
      : []
  })
  const first = tabs[0]
  return first
    ? {
        ...window,
        tabs,
        activeTabId: tabs.some((tab) => tab.id === window.activeTabId)
          ? window.activeTabId
          : first.id
      }
    : null
}
