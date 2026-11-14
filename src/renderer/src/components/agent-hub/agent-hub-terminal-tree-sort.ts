import type { AppState } from '@/store/types'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import type { Repo } from '../../../../shared/repo-types'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../../../shared/agent-status/contracts/agent-status-freshness'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  buildWorktreeComparator,
  sortWorktreesSmart
} from '../../../../shared/sidebar-list/sorting/smart-sort'
import { agentHubIndicatorKind, agentHubStateSince } from './agent-hub-lists'
import type {
  AgentHubGroupNode,
  AgentHubTerminalRow,
  AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'

export type AgentHubTreeOrder = {
  sortBy: AgentHubTerminalSort
  /** Worktree id → its place in the sidebar's order for this sort; empty for Name and Project. */
  workspaceRank: ReadonlyMap<string, number>
  /** When the order was taken: a result ranks as finished only while it is fresh. */
  now: number
}

/** The worktrees of the workers nested under these rows, at any depth. */
function nestedWorktrees(rows: readonly AgentHubTerminalRow[]): Worktree[] {
  return rows.flatMap((row) => [
    ...row.children.map((child) => child.worktree),
    ...nestedWorktrees(row.children)
  ])
}

/** The store fields the sidebar's Agent Activity order reads. */
export type AgentHubWorkspaceRankSources = Pick<
  AppState,
  | 'tabsByWorktree'
  | 'agentStatusByPaneKey'
  | 'runtimePaneTitlesByTabId'
  | 'ptyIdsByTabId'
  | 'migrationUnsupportedByPtyId'
  | 'terminalLayoutsByTabId'
>

/**
 * Ranks the listed workspaces with the sidebar's own comparator, so both surfaces agree. Agent
 * Activity inherits the sidebar's cold start: until a terminal or agent status is live, the
 * persisted order stands in.
 */
export function rankAgentHubWorkspaces(
  groups: readonly AgentHubGroupNode[],
  sortBy: AgentHubTerminalSort,
  sources: AgentHubWorkspaceRankSources,
  repoMap: Map<string, Repo>,
  now: number
): Map<string, number> {
  // Name orders by the labels the hub shows and Project keeps the tree as built.
  if (sortBy === 'name' || sortBy === 'repo') {
    return new Map()
  }
  // Workers listed under a dispatcher elsewhere are ranked too: their workspace may list nothing.
  const worktreesById = new Map<string, Worktree>()
  for (const group of groups) {
    for (const workspace of group.workspaces) {
      for (const worktree of [workspace.worktree, ...nestedWorktrees(workspace.rows)]) {
        worktreesById.set(worktree.id, worktree)
      }
    }
  }
  const worktrees = [...worktreesById.values()]
  const sorted =
    sortBy === 'smart'
      ? sortWorktreesSmart(
          worktrees,
          sources.tabsByWorktree,
          repoMap,
          sources.agentStatusByPaneKey,
          sources.runtimePaneTitlesByTabId,
          sources.ptyIdsByTabId,
          sources.migrationUnsupportedByPtyId,
          sources.terminalLayoutsByTabId
        )
      : // The attention map is read by Agent Activity only.
        worktrees.sort(buildWorktreeComparator(sortBy, repoMap, now, new Map()))
  return new Map(sorted.map((worktree, index) => [worktree.id, index]))
}

/**
 * A row's class in the sidebar's Agent Activity order (needs you, finished, working, the rest),
 * read from the state the row itself shows. Like the sidebar, a result ranks as finished only
 * while it is fresh; an older unread one joins the rest instead of sitting above working agents
 * for days. Idle agents and shells have no thread and come last.
 */
function rowActivityClass(row: AgentHubTerminalRow, now: number): number {
  if (!row.thread) {
    return row.idleAgent ? 5 : 6
  }
  switch (agentHubIndicatorKind(row.thread)) {
    case 'ask':
      return 1
    case 'done':
      return now - agentHubStateSince(row.thread) <= AGENT_STATUS_STALE_AFTER_MS ? 2 : 4
    case 'work':
      return 3
    case 'read':
    case 'idle':
      return 4
  }
}

function compareRowTitle(a: AgentHubTerminalRow, b: AgentHubTerminalRow): number {
  return a.title.localeCompare(b.title) || a.key.localeCompare(b.key)
}

// A thread-less row has no activity of its own on record; when its tab opened is all there is.
function rowStateSince(row: AgentHubTerminalRow): number {
  return row.thread ? agentHubStateSince(row.thread) : row.tab.createdAt
}

function rowLatestActivity(row: AgentHubTerminalRow): number {
  return row.thread ? row.thread.latestTimestamp : row.tab.createdAt
}

type RowComparator = (a: AgentHubTerminalRow, b: AgentHubTerminalRow) => number

/** Null where rows keep their tab order (Project and Manual). */
function rowComparator(sortBy: AgentHubTerminalSort, now: number): RowComparator | null {
  switch (sortBy) {
    case 'name':
      return compareRowTitle
    case 'smart':
      return (a, b) =>
        rowActivityClass(a, now) - rowActivityClass(b, now) ||
        rowStateSince(b) - rowStateSince(a) ||
        compareRowTitle(a, b)
    case 'recent':
      return (a, b) => rowLatestActivity(b) - rowLatestActivity(a) || compareRowTitle(a, b)
    case 'repo':
    case 'manual':
      return null
  }
}

// Workers are ordered among themselves and stay under their dispatcher.
function sortRows(
  rows: readonly AgentHubTerminalRow[],
  compare: RowComparator
): AgentHubTerminalRow[] {
  return rows
    .map((row) =>
      row.children.length > 1 ? { ...row, children: sortRows(row.children, compare) } : row
    )
    .sort(compare)
}

function compareWorkspaceLabel(a: AgentHubWorkspaceNode, b: AgentHubWorkspaceNode): number {
  return (
    a.projectLabel.localeCompare(b.projectLabel) ||
    (a.workspaceLabel ?? '').localeCompare(b.workspaceLabel ?? '')
  )
}

/**
 * Orders an already built (and filtered) tree. Project is the tree as built: groups in sidebar
 * tab order, then projects, workspaces and tabs. Groups and rows are never regrouped, so collapse
 * state and the arrow-key walk simply follow the result.
 */
export function sortAgentHubTerminalTree(
  groups: readonly AgentHubGroupNode[],
  order: AgentHubTreeOrder
): AgentHubGroupNode[] {
  const { sortBy, workspaceRank, now } = order
  if (sortBy === 'repo') {
    return [...groups]
  }
  const rankOf = (worktree: Worktree): number =>
    workspaceRank.get(worktree.id) ?? Number.POSITIVE_INFINITY
  // Why the nested workers count: a worker that needs the user is listed under its dispatcher, so
  // that workspace is where the user finds it. Manual is the workspace's own place only.
  const ranks = new Map<AgentHubWorkspaceNode, number>()
  const rank = (workspace: AgentHubWorkspaceNode): number => {
    let value = ranks.get(workspace)
    if (value === undefined) {
      const listed =
        sortBy === 'manual'
          ? [workspace.worktree]
          : [workspace.worktree, ...nestedWorktrees(workspace.rows)]
      value = Math.min(...listed.map(rankOf))
      ranks.set(workspace, value)
    }
    return value
  }
  const compareWorkspaces =
    sortBy === 'name'
      ? compareWorkspaceLabel
      : (a: AgentHubWorkspaceNode, b: AgentHubWorkspaceNode): number => rank(a) - rank(b)
  const compareRows = rowComparator(sortBy, now)
  const sorted = groups.map((group) => ({
    ...group,
    workspaces: group.workspaces
      .map((workspace) =>
        compareRows ? { ...workspace, rows: sortRows(workspace.rows, compareRows) } : workspace
      )
      .sort(compareWorkspaces)
  }))
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.label.localeCompare(b.label))
    case 'smart':
    case 'recent': {
      // A group stands where its best workspace does.
      const best = (group: AgentHubGroupNode): number =>
        group.workspaces[0] ? rank(group.workspaces[0]) : Number.POSITIVE_INFINITY
      return sorted.sort((a, b) => best(a) - best(b))
    }
    case 'manual':
      // Groups keep the sidebar's tab order: it is their manual order.
      return sorted
  }
}
