import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'

/** The hub's row for a terminal tab: its agent pane when it has one, else the tab itself. */
export function agentHubRowOfTab(
  tree: readonly AgentHubGroupNode[],
  tabId: string
): AgentHubTerminalRow | null {
  const find = (rows: readonly AgentHubTerminalRow[]): AgentHubTerminalRow | null => {
    for (const row of rows) {
      const found = row.tab.id === tabId ? row : find(row.children)
      if (found) {
        return found
      }
    }
    return null
  }
  for (const group of tree) {
    for (const workspace of group.workspaces) {
      const found = find(workspace.rows)
      if (found) {
        return found
      }
    }
  }
  return null
}
