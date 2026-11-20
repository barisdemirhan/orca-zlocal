import { useMemo } from 'react'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'

export type AgentHubTerminalCountInput = {
  threads: readonly AgentPaneThread[]
  includeShells: boolean
  parentOf: ReadonlyMap<string, string>
}

/** How many rows each terminals tab lists, read from one tree build. */
export function useAgentHubTerminalCounts({
  threads,
  includeShells,
  parentOf
}: AgentHubTerminalCountInput): { agents: number; all: number } {
  const tree = useAgentHubTerminalTree(threads, includeShells, parentOf)
  return useMemo(
    () =>
      tree.reduce(
        (counts, group) => ({
          agents: counts.agents + group.agentRowCount,
          all: counts.all + group.rowCount
        }),
        { agents: 0, all: 0 }
      ),
    [tree]
  )
}
