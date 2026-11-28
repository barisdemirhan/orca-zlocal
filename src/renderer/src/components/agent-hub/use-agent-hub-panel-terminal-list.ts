import { useMemo } from 'react'
import type { AgentHubTab } from './agent-hub-keys'
import { useAgentHubPanelListState } from './agent-hub-panel-list-state'
import { useAgentHubStateCounts, type AgentHubStateCounts } from './agent-hub-state-filter'
import { agentOnlyAgentHubTree, type AgentHubGroupNode } from './agent-hub-terminal-tree'
import type { AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'
import { isAgentHubTreeNarrowed } from './agent-hub-terminal-tree-view'
import {
  splitAgentHubBotChats,
  tallyAgentHubBotChats,
  type AgentHubBotChatTally
} from './agent-hub-tree-bot-groups'
import type { useAgentHubHostFilter } from './use-agent-hub-host-filter'
import { useAgentHubSortedTree } from './use-agent-hub-sorted-tree'
import { useAgentHubSurfaceSetting } from './use-agent-hub-surface-setting'
import { useHeldAgentHubTree } from './use-held-agent-hub-tree'

export type AgentHubPanelTerminals = {
  agentCount: number
  filteredTree: readonly AgentHubGroupNode[]
  narrowed: boolean
  foldAgentsList: boolean
  stateCounts: AgentHubStateCounts
  /** The bots whose chats the Agents list leaves to the Bots tab; null when it leaves none out. */
  botTallies: readonly AgentHubBotChatTally[] | null
}

/** The Agents and All lists after the panel's search, filters, sort and folds. */
export function useAgentHubPanelTerminalList(
  tab: AgentHubTab,
  tree: readonly AgentHubGroupNode[],
  treeOrder: AgentHubTreeOrder,
  hostFilter: ReturnType<typeof useAgentHubHostFilter>
): AgentHubPanelTerminals {
  const { query, windowFilter, unreadOnly, botStartedOnly, idleFoldOpen, sortByHost, stateFilter } =
    useAgentHubPanelListState()
  const showBotChatsInAgents = useAgentHubSurfaceSetting('agentHubShowBotChatsInAgents')
  const foldIdleAgents = useAgentHubSurfaceSetting('agentHubFoldIdleAgents')
  const botSplit = useMemo(() => splitAgentHubBotChats(tree), [tree])
  const agentTree = useMemo(
    () => agentOnlyAgentHubTree(showBotChatsInAgents ? tree : botSplit.rest),
    [tree, botSplit, showBotChatsInAgents]
  )
  const tallies = useMemo(() => tallyAgentHubBotChats(botSplit.botGroup), [botSplit])
  const foldAgentsList = foldIdleAgents && tab === 'agents'
  const shownTree = tab === 'agents' ? agentTree : tree
  const stateCounts = useAgentHubStateCounts(shownTree, windowFilter, hostFilter.rowTest)
  const sortedTree = useAgentHubSortedTree(
    shownTree,
    query,
    treeOrder,
    windowFilter,
    hostFilter.rowTest,
    {
      unreadOnly,
      botStartedOnly,
      stateFilter,
      sortByHost,
      foldIdle: foldAgentsList ? { openKeys: idleFoldOpen } : null
    }
  )
  const filteredTree = useHeldAgentHubTree(
    sortedTree,
    `${tab}\u0000${treeOrder.sortBy}\u0000${query}\u0000${windowFilter}\u0000${hostFilter.value}\u0000${unreadOnly}\u0000${botStartedOnly}\u0000${stateFilter}\u0000${sortByHost}`
  )
  return {
    agentCount: agentTree.reduce((total, group) => total + group.rowCount, 0),
    filteredTree,
    narrowed: isAgentHubTreeNarrowed(
      query,
      windowFilter,
      hostFilter.value,
      unreadOnly || botStartedOnly || stateFilter !== 'all'
    ),
    foldAgentsList,
    stateCounts,
    botTallies: tab === 'agents' && !showBotChatsInAgents ? tallies : null
  }
}
