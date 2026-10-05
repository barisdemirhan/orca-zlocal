import type { AgentPaneThread } from '../activity/activity-thread-types'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'

/** How many rows All terminals lists. Mounted only while the dock is unfolded: it builds the tree. */
export function AgentHubTerminalCount({
  threads,
  includeShells,
  parentOf
}: {
  threads: readonly AgentPaneThread[]
  includeShells: boolean
  parentOf: ReadonlyMap<string, string>
}): number {
  const tree = useAgentHubTerminalTree(threads, includeShells, parentOf)
  return tree.reduce((total, group) => total + group.rowCount, 0)
}
