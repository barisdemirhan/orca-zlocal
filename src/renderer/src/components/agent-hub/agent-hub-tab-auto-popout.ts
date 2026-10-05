import { useSyncExternalStore } from 'react'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'

// Terminal tabs whose toggle is on. Kept for the session only: tab ids do not outlive a restart
// of their terminals in a way worth persisting, and the toggle is one click to set again.
let autoTabs: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isAgentHubTabAutoPopout(tabId: string): boolean {
  return autoTabs.has(tabId)
}

export function toggleAgentHubTabAutoPopout(tabId: string): void {
  const next = new Set(autoTabs)
  if (!next.delete(tabId)) {
    next.add(tabId)
  }
  autoTabs = next
  listeners.forEach((listener) => listener())
}

/** Whether this terminal tab pops out into the tray when the user leaves it. */
export function useIsAgentHubTabAutoPopout(tabId: string): boolean {
  const isOn = (): boolean => autoTabs.has(tabId)
  // Why the server snapshot: tab-strip tests render tabs to static markup.
  return useSyncExternalStore(subscribe, isOn, isOn)
}

/** Test seam: start every case with no tab toggled. */
export function resetAgentHubTabAutoPopoutForTest(): void {
  autoTabs = new Set()
}

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
