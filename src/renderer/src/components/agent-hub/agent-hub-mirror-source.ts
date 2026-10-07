import type { AgentHubMirrorWindowState } from './agent-hub-mirror-membership'
import { useAppStore } from '@/store'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { collectLeafIdsInOrder } from '../terminal-pane/terminal-layout-leaf-ids'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'

type SourceState = Parameters<typeof agentHubTerminalTreeFromState>[0]
const NO_PARENTS: ReadonlyMap<string, string> = new Map()

export function findAgentHubMirrorSource(
  state: SourceState,
  reference: { worktreeId: string; tabId: string; hostIdentity: string | null }
): AgentHubTerminalRow | null {
  const matches: AgentHubTerminalRow[] = []
  const find = (rows: readonly AgentHubTerminalRow[]): void => {
    for (const row of rows) {
      if (
        row.tab.id === reference.tabId &&
        row.worktree.id === reference.worktreeId &&
        (reference.hostIdentity === null ||
          getWorktreeHostIdentity(row.worktree) === reference.hostIdentity)
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
  const hosts = new Set(matches.map((row) => getWorktreeHostIdentity(row.worktree)))
  return hosts.size === 1 ? (matches[0] ?? null) : null
}

export function agentHubMirrorPaneExists(
  state: SourceState,
  tabId: string,
  paneKey: string
): boolean {
  const parsed = parsePaneKey(paneKey)
  const layout = state.terminalLayoutsByTabId[tabId]
  return Boolean(
    layout &&
    parsed?.tabId === tabId &&
    (layout.activeLeafId === parsed.leafId ||
      collectLeafIdsInOrder(layout.root).includes(parsed.leafId) ||
      Object.hasOwn(layout.ptyIdsByLeafId ?? {}, parsed.leafId))
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

export function resolveAgentHubMirrorWindow(
  window: AgentHubMirrorWindowState,
  resolveTarget = resolveAgentHubMirrorTarget
): AgentHubMirrorWindowState | null {
  const tabs = window.tabs.flatMap((tab) => {
    const target = resolveTarget(tab.target)
    return target ? [{ ...tab, target, origin: 'manual' as const }] : []
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
