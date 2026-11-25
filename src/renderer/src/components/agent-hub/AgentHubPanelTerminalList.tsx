import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { AgentHubStateChips } from './AgentHubStateChips'
import { AgentHubTerminalTree } from './AgentHubTerminalTree'
import type { AgentHubLineage } from './agent-hub-lineage'
import {
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import type { useAgentHubHostFilter } from './use-agent-hub-host-filter'
import type { AgentHubPanelTerminals } from './use-agent-hub-panel-terminal-list'

/** The Agents and All tabs' body: the tree with its search, filters, chips and sort. */
export function AgentHubPanelTerminalList({
  list,
  totalCount,
  searchRef,
  hostFilter,
  botsAvailable,
  onOpenBots,
  sortBy,
  onSortChange,
  onListChanged,
  onMarkRead,
  selectedKey,
  now,
  lineage,
  expandedKeys,
  onOpen,
  onPopout,
  onJump
}: {
  list: AgentHubPanelTerminals
  totalCount: number
  searchRef: React.RefObject<HTMLInputElement | null>
  hostFilter: ReturnType<typeof useAgentHubHostFilter>
  botsAvailable: boolean
  onOpenBots: (botKey: string | null) => void
  sortBy: AgentHubTerminalSort
  onSortChange: (sortBy: AgentHubTerminalSort) => void
  /** A filter or sort changed, so the selected row may be gone. */
  onListChanged: () => void
  onMarkRead: (paneKeys: string[]) => void
  selectedKey: string | null
  now: number
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  onOpen: (row: AgentHubTerminalRow) => void
  onPopout: (row: AgentHubTerminalRow) => void
  onJump: (row: AgentHubTerminalRow) => void
}): React.JSX.Element {
  const {
    query,
    windowFilter,
    collapseOverrides,
    unreadOnly,
    botStartedOnly,
    idleFoldOpen,
    sortByHost,
    stateFilter
  } = useAgentHubPanelListState()
  const change = (patch: Parameters<typeof updateAgentHubPanelListState>[0]): void => {
    updateAgentHubPanelListState(patch)
    onListChanged()
  }
  return (
    <AgentHubTerminalTree
      groups={list.filteredTree}
      totalCount={totalCount}
      query={query}
      onQueryChange={(value) => change({ query: value })}
      searchRef={searchRef}
      stateFiltered={stateFilter !== 'all'}
      filterBar={
        <AgentHubStateChips
          value={stateFilter}
          counts={list.stateCounts}
          onChange={(next) => change({ stateFilter: next })}
        />
      }
      foldSleeping={list.foldAgentsList}
      onToggleIdle={(workspaceKey) => {
        const next = new Set(idleFoldOpen)
        if (!next.delete(workspaceKey)) {
          next.add(workspaceKey)
        }
        updateAgentHubPanelListState({ idleFoldOpen: next })
      }}
      botChats={
        list.botTallies && botsAvailable ? { tallies: list.botTallies, onOpenBots } : undefined
      }
      windowFilter={{
        toggles: { unreadOnly, botStartedOnly, botsAvailable, onChange: change },
        value: windowFilter,
        onChange: (next) => change({ windowFilter: next }),
        host: hostFilter
      }}
      sortBy={sortBy}
      onSortChange={(next) => {
        onSortChange(next)
        change({ sortByHost: false })
      }}
      sortByHost={sortByHost}
      onSortByHostChange={(value) => change({ sortByHost: value })}
      onMarkRead={(row) => row.paneKey && onMarkRead([row.paneKey])}
      collapseOverrides={collapseOverrides}
      onToggleGroup={(group, collapsed) =>
        updateAgentHubPanelListState({
          collapseOverrides: new Map(collapseOverrides).set(group.key, collapsed)
        })
      }
      selectedKey={selectedKey}
      now={now}
      lineage={lineage}
      expandedKeys={expandedKeys}
      onOpen={onOpen}
      onPopout={onPopout}
      onJump={onJump}
    />
  )
}
