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
  agentHubRowMatchesState,
  applyAgentHubStateGroupFilter,
  type AgentHubStateFilter
} from './agent-hub-state-filter'
import { sortAgentHubWorkspacesByHost } from './agent-hub-tree-host-sort'
import { agentHubRowIsIdleAgent, foldAgentHubIdleRows } from './agent-hub-tree-bot-groups'
import {
  useAgentHubWindowFilterRowTest,
  type AgentHubWindowFilter
} from './agent-hub-window-filter'

export type AgentHubTreeExtras = {
  unreadOnly?: boolean
  botStartedOnly?: boolean
  stateFilter?: AgentHubStateFilter
  /** Orders each group's workspaces by host (local first), keeping the sort within a host. */
  sortByHost?: boolean
  /** Folds idle agents behind a count, except the workspaces named here. */
  foldIdle?: { openKeys: ReadonlySet<string> } | null
}

export function useAgentHubSortedTree(
  tree: readonly AgentHubGroupNode[],
  query: string,
  order: AgentHubTreeOrder,
  filter: AgentHubWindowFilter,
  hostTest?: (row: AgentHubTerminalRow) => boolean,
  extras: AgentHubTreeExtras = {}
): AgentHubGroupNode[] {
  const isSleeping = useAgentHubSleepingTargetTest()
  const windowTest = useAgentHubWindowFilterRowTest(filter)
  const {
    unreadOnly = false,
    botStartedOnly = false,
    stateFilter = 'all',
    sortByHost = false,
    foldIdle = null
  } = extras
  const rowTest = useMemo(() => {
    const tests = [
      windowTest,
      hostTest,
      unreadOnly ? (row: AgentHubTerminalRow) => row.thread?.unread === true : undefined,
      botStartedOnly ? (row: AgentHubTerminalRow) => row.bot !== undefined : undefined,
      stateFilter !== 'all' && stateFilter !== 'sleep'
        ? (row: AgentHubTerminalRow) => agentHubRowMatchesState(row, stateFilter)
        : undefined
    ].filter((test) => test !== undefined)
    return tests.length === 0 ? undefined : (row: AgentHubTerminalRow) => tests.every((t) => t(row))
  }, [windowTest, hostTest, unreadOnly, botStartedOnly, stateFilter])
  // A search or filter shows every match, so nothing folds then.
  const narrowed = query.trim() !== '' || rowTest !== undefined || stateFilter !== 'all'
  const openKeys = foldIdle?.openKeys
  return useMemo(() => {
    const grouped = applyAgentHubStateGroupFilter(
      groupAgentHubSleepingRows(tree, isSleeping),
      stateFilter
    )
    const matched = filterAgentHubTerminalTree(grouped, query)
    const ordered = sortAgentHubTerminalTree(
      rowTest ? filterAgentHubTerminalTreeRows(matched, rowTest) : matched,
      order
    )
    const sorted = sortByHost ? sortAgentHubWorkspacesByHost(ordered) : ordered
    return openKeys && !narrowed
      ? foldAgentHubIdleRows(sorted, openKeys, agentHubRowIsIdleAgent)
      : sorted
  }, [tree, query, order, isSleeping, rowTest, openKeys, narrowed, sortByHost, stateFilter])
}
