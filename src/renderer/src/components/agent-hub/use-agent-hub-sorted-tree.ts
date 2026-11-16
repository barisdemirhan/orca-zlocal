import { useMemo } from 'react'
import { useAgentHubSleepingTargetTest } from './agent-hub-pane-sleep'
import { groupAgentHubSleepingRows } from './agent-hub-sleeping-groups'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { sortAgentHubTerminalTree, type AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'
import {
  filterAgentHubTerminalTree,
  filterAgentHubTerminalTreeRows
} from './agent-hub-terminal-tree-view'
import {
  useAgentHubWindowFilterRowTest,
  type AgentHubWindowFilter
} from './agent-hub-window-filter'

export function useAgentHubSortedTree(
  tree: readonly AgentHubGroupNode[],
  query: string,
  order: AgentHubTreeOrder,
  filter: AgentHubWindowFilter,
  hostTest?: (row: AgentHubTerminalRow) => boolean
): AgentHubGroupNode[] {
  const isSleeping = useAgentHubSleepingTargetTest()
  const windowTest = useAgentHubWindowFilterRowTest(filter)
  const rowTest = useMemo(
    () =>
      windowTest && hostTest
        ? (row: AgentHubTerminalRow) => windowTest(row) && hostTest(row)
        : (windowTest ?? hostTest),
    [windowTest, hostTest]
  )
  return useMemo(() => {
    const grouped = groupAgentHubSleepingRows(tree, isSleeping)
    const matched = filterAgentHubTerminalTree(grouped, query)
    return sortAgentHubTerminalTree(
      rowTest ? filterAgentHubTerminalTreeRows(matched, rowTest) : matched,
      order
    )
  }, [tree, query, order, isSleeping, rowTest])
}
