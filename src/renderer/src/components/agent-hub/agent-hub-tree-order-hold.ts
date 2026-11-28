import type {
  AgentHubGroupNode,
  AgentHubTerminalRow,
  AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'

/** Where every group, workspace and row stood when an order was taken. */
export type AgentHubTreePlaces = ReadonlyMap<string, number>

const groupKey = (group: AgentHubGroupNode): string => `g:${group.key}`
const workspaceKey = (workspace: AgentHubWorkspaceNode): string => `w:${workspace.key}`
const rowKey = (row: AgentHubTerminalRow): string => `r:${row.key}`

/** The places of a sorted tree, in reading order. */
export function agentHubTreePlaces(groups: readonly AgentHubGroupNode[]): Map<string, number> {
  const places = new Map<string, number>()
  const note = (key: string): void => {
    places.set(key, places.size)
  }
  const noteRows = (rows: readonly AgentHubTerminalRow[]): void => {
    for (const row of rows) {
      note(rowKey(row))
      noteRows(row.children)
    }
  }
  for (const group of groups) {
    note(groupKey(group))
    for (const workspace of group.workspaces) {
      note(workspaceKey(workspace))
      noteRows(workspace.rows)
    }
  }
  return places
}

export function sameAgentHubTreePlaces(a: AgentHubTreePlaces, b: AgentHubTreePlaces): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const [key, place] of a) {
    if (b.get(key) !== place) {
      return false
    }
  }
  return true
}

/**
 * Puts a freshly sorted tree back into the places held from a moment ago, so a row whose agent
 * just changed state shows the new state at once but does not jump away from under the pointer.
 * Anything the held order has not seen yet keeps its fresh position after the rest.
 */
export function holdAgentHubTreePlaces(
  sorted: readonly AgentHubGroupNode[],
  held: AgentHubTreePlaces
): AgentHubGroupNode[] {
  const fresh = agentHubTreePlaces(sorted)
  const placeOf = (key: string): number => held.get(key) ?? held.size + (fresh.get(key) ?? 0)
  const holdRows = (rows: readonly AgentHubTerminalRow[]): AgentHubTerminalRow[] =>
    rows
      .map((row) => (row.children.length > 1 ? { ...row, children: holdRows(row.children) } : row))
      .sort((a, b) => placeOf(rowKey(a)) - placeOf(rowKey(b)))
  return sorted
    .map((group) => ({
      ...group,
      workspaces: group.workspaces
        .map((workspace) => ({ ...workspace, rows: holdRows(workspace.rows) }))
        .sort((a, b) => placeOf(workspaceKey(a)) - placeOf(workspaceKey(b)))
    }))
    .sort((a, b) => placeOf(groupKey(a)) - placeOf(groupKey(b)))
}
