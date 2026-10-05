import type { AgentPaneThread } from '../activity/activity-thread-types'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'

/**
 * How many rows a terminals tab lists: every agent terminal (busy or idle), or all terminals.
 * It builds the tree, so the all-terminals count mounts only while the dock is unfolded.
 */
export function AgentHubTerminalCount({
  only,
  threads,
  includeShells,
  parentOf
}: {
  only: 'agents' | 'all'
  threads: readonly AgentPaneThread[]
  includeShells: boolean
  parentOf: ReadonlyMap<string, string>
}): number {
  const tree = useAgentHubTerminalTree(threads, includeShells, parentOf)
  return tree.reduce(
    (total, group) => total + (only === 'agents' ? group.agentRowCount : group.rowCount),
    0
  )
}
