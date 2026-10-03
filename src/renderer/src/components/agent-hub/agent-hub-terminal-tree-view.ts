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

/** Keep rows whose text holds every query word; empty groups and workspaces drop out. */
export function filterAgentHubTerminalTree(
  groups: readonly AgentHubGroupNode[],
  query: string
): AgentHubGroupNode[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return [...groups]
  }
  const filtered: AgentHubGroupNode[] = []
  for (const group of groups) {
    const workspaces: AgentHubWorkspaceNode[] = []
    for (const workspace of group.workspaces) {
      const matches = (row: AgentHubTerminalRow): boolean => {
        const text = rowSearchText(group, workspace, row)
        return words.every((word) => text.includes(word))
      }
      const rows = workspace.rows.flatMap((row) => filterRow(row, matches) ?? [])
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

/** A group starts collapsed when it holds only shells; the user's toggle wins after that. */
export function isAgentHubGroupCollapsed(
  group: AgentHubGroupNode,
  overrides: ReadonlyMap<string, boolean>,
  query: string
): boolean {
  if (query.trim()) {
    return false
  }
  return overrides.get(group.key) ?? group.agentRowCount === 0
}

/** Children start folded; a search unfolds every match. */
export function isAgentHubRowExpanded(
  key: string,
  expandedKeys: ReadonlySet<string>,
  query: string
): boolean {
  return query.trim() !== '' || expandedKeys.has(key)
}

/** Rows in display order, skipping collapsed groups and folded workers: the arrow-key selection space. */
export function visibleAgentHubTreeRows(
  groups: readonly AgentHubGroupNode[],
  overrides: ReadonlyMap<string, boolean>,
  query: string,
  expandedKeys: ReadonlySet<string> = new Set()
): AgentHubTerminalRow[] {
  const withChildren = (row: AgentHubTerminalRow): AgentHubTerminalRow[] =>
    isAgentHubRowExpanded(row.key, expandedKeys, query)
      ? [row, ...row.children.flatMap(withChildren)]
      : [row]
  return groups.flatMap((group) =>
    isAgentHubGroupCollapsed(group, overrides, query)
      ? []
      : group.workspaces.flatMap((workspace) => workspace.rows.flatMap(withChildren))
  )
}
