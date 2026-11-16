import { AGENT_HUB_SLEEPING_GROUP } from './agent-hub-sleeping-groups'
import {
  countRows,
  type AgentHubGroupNode,
  type AgentHubTerminalRow,
  type AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'

function rowSearchText(
  group: AgentHubGroupNode,
  workspace: AgentHubWorkspaceNode,
  row: AgentHubTerminalRow
): string {
  return [
    row.title,
    group.label,
    workspace.projectLabel,
    workspace.workspaceLabel ?? '',
    // A worker nested under a dispatcher elsewhere still matches its own project and branch.
    row.repo?.displayName ?? '',
    row.worktree.displayName || row.worktree.branch || '',
    row.thread ? row.thread.agentType : 'shell'
  ]
    .join(' ')
    .toLowerCase()
}

/** A matching row keeps all its workers; otherwise it stays only as the path to a matching worker. */
function filterRow(
  row: AgentHubTerminalRow,
  matches: (row: AgentHubTerminalRow) => boolean
): AgentHubTerminalRow | null {
  if (matches(row)) {
    return row
  }
  const children = row.children.flatMap((child) => filterRow(child, matches) ?? [])
  return children.length > 0 ? { ...row, children } : null
}

/** Rebuilds the tree from the rows `pruneRow` keeps; empty groups and workspaces drop out. */
function pruneAgentHubTerminalTree(
  groups: readonly AgentHubGroupNode[],
  pruneRow: (
    row: AgentHubTerminalRow,
    group: AgentHubGroupNode,
    workspace: AgentHubWorkspaceNode
  ) => AgentHubTerminalRow | null
): AgentHubGroupNode[] {
  const filtered: AgentHubGroupNode[] = []
  for (const group of groups) {
    const workspaces: AgentHubWorkspaceNode[] = []
    for (const workspace of group.workspaces) {
      const rows = workspace.rows.flatMap((row) => pruneRow(row, group, workspace) ?? [])
      if (rows.length > 0) {
        workspaces.push({ ...workspace, rows })
      }
    }
    if (workspaces.length > 0) {
      filtered.push({ ...group, workspaces, ...countRows(workspaces) })
    }
  }
  return filtered
}

/** Keep rows whose text holds every query word. */
export function filterAgentHubTerminalTree(
  groups: readonly AgentHubGroupNode[],
  query: string
): AgentHubGroupNode[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return [...groups]
  }
  return pruneAgentHubTerminalTree(groups, (row, group, workspace) =>
    filterRow(row, (candidate) => {
      const text = rowSearchText(group, workspace, candidate)
      return words.every((word) => text.includes(word))
    })
  )
}

/** Keep rows that pass `keep`, each worker on its own; a failing row stays only as a worker's path. */
function keepRow(
  row: AgentHubTerminalRow,
  keep: (row: AgentHubTerminalRow) => boolean
): AgentHubTerminalRow | null {
  const children = row.children.flatMap((child) => keepRow(child, keep) ?? [])
  return keep(row) || children.length > 0 ? { ...row, children } : null
}

/** A structural filter (where a row's mirror stands), applied to workers as well as their parents. */
export function filterAgentHubTerminalTreeRows(
  groups: readonly AgentHubGroupNode[],
  keep: (row: AgentHubTerminalRow) => boolean
): AgentHubGroupNode[] {
  return pruneAgentHubTerminalTree(groups, (row) => keepRow(row, keep))
}

/** Whether a search or filter narrows the list, which unfolds everything it leaves. */
export function isAgentHubTreeNarrowed(
  query: string,
  windowFilter: string = 'any',
  host: string | null = null
): boolean {
  return query.trim() !== '' || windowFilter !== 'any' || host !== null
}

/** A group starts collapsed when it holds only shells; the user's toggle wins after that. */
export function isAgentHubGroupCollapsed(
  group: AgentHubGroupNode,
  overrides: ReadonlyMap<string, boolean>,
  narrowed: boolean
): boolean {
  if (narrowed) {
    return false
  }
  return (
    overrides.get(group.key) ??
    (group.key !== AGENT_HUB_SLEEPING_GROUP && group.agentRowCount === 0)
  )
}

/** Children start folded; a search or filter unfolds every match. */
export function isAgentHubRowExpanded(
  key: string,
  expandedKeys: ReadonlySet<string>,
  narrowed: boolean
): boolean {
  return narrowed || expandedKeys.has(key)
}

/** Rows in display order, skipping collapsed groups and folded workers: the arrow-key selection space. */
export function visibleAgentHubTreeRows(
  groups: readonly AgentHubGroupNode[],
  overrides: ReadonlyMap<string, boolean>,
  narrowed: boolean,
  expandedKeys: ReadonlySet<string> = new Set()
): AgentHubTerminalRow[] {
  const withChildren = (row: AgentHubTerminalRow): AgentHubTerminalRow[] =>
    isAgentHubRowExpanded(row.key, expandedKeys, narrowed)
      ? [row, ...row.children.flatMap(withChildren)]
      : [row]
  return groups.flatMap((group) =>
    isAgentHubGroupCollapsed(group, overrides, narrowed)
      ? []
      : group.workspaces.flatMap((workspace) => workspace.rows.flatMap(withChildren))
  )
}
