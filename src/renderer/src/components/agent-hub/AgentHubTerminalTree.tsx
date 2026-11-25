import { useId } from 'react'
import { Folder, GitBranch, Search } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { HubChip, HubKeys } from './AgentHubInlineLabels'
import { HubCollapse, HubFoldChevron } from './AgentHubFold'
import { AgentHubTerminalSortMenu } from './AgentHubTerminalSortMenu'
import { AgentHubWindowFilterMenu, type AgentHubRowToggles } from './AgentHubWindowFilterMenu'
import { GroupSummary, WorkspaceHostBadge } from './AgentHubTreeGroupSummary'
import { AgentHubBotChatsLine, AgentHubBotSearchHits } from './AgentHubTreeBotLines'
import { AgentHubGroupContextMenu } from './AgentHubGroupContextMenu'
import { TreeRow, type TreeRowContext } from './AgentHubTreeRow'
import type { AgentHubBotChatTally } from './agent-hub-tree-bot-groups'
import type { AgentHubHostFilter } from './use-agent-hub-host-filter'
import { agentHubWindowFilterOption, type AgentHubWindowFilter } from './agent-hub-window-filter'
import { useAgentHubSleepingTargetTest } from './agent-hub-pane-sleep'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { AgentHubLineage } from './agent-hub-lineage'
import type {
  AgentHubGroupNode,
  AgentHubTerminalRow,
  AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'
import { AGENT_HUB_BOTS_GROUP } from './agent-hub-terminal-tree'
import { AGENT_HUB_SLEEPING_GROUP } from './agent-hub-sleeping-groups'
import { isAgentHubGroupCollapsed, isAgentHubTreeNarrowed } from './agent-hub-terminal-tree-view'

export function AgentHubTerminalTree({
  groups,
  totalCount,
  query,
  onQueryChange,
  searchRef,
  sortBy,
  onSortChange,
  collapseOverrides,
  onToggleGroup,
  selectedKey,
  now,
  lineage,
  expandedKeys,
  onOpen,
  onPopout,
  onJump,
  onMarkRead,
  sortByHost,
  onSortByHostChange,
  selectionMode = false,
  onToggleChildren,
  emptyLabel,
  windowFilter,
  renderWorkspaceAction,
  filterBar,
  stateFiltered = false,
  emptyState,
  foldSleeping = false,
  onToggleIdle,
  botChats
}: {
  /** Folds the sleeping agents' group closed until opened. */
  foldSleeping?: boolean
  onToggleIdle?: (workspaceKey: string) => void
  /** The bots' chats that are kept out of this list, for the closing line and bot search hits. */
  botChats?: {
    tallies: readonly AgentHubBotChatTally[]
    onOpenBots: (botKey: string | null) => void
  }
  groups: readonly AgentHubGroupNode[]
  renderWorkspaceAction?: (workspace: AgentHubWorkspaceNode) => React.ReactNode
  totalCount: number
  emptyLabel?: string
  /** Sits under the search row, inside the sticky header. */
  filterBar?: React.ReactNode
  /** A state chip other than All is on, which unfolds what it leaves like a search does. */
  stateFiltered?: boolean
  /** Replaces the empty message when nothing is left and no search is typed. */
  emptyState?: React.ReactNode
  /** Shows the window filter beside the sort; the hub's lists have it, the picker does not. */
  windowFilter?: {
    value: AgentHubWindowFilter
    onChange: (filter: AgentHubWindowFilter) => void
    host?: Pick<AgentHubHostFilter, 'value' | 'options' | 'onChange'>
    toggles?: AgentHubRowToggles
  }
  query: string
  onQueryChange: (query: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  sortBy: AgentHubTerminalSort
  onSortChange: (sortBy: AgentHubTerminalSort) => void
  collapseOverrides: ReadonlyMap<string, boolean>
  onToggleGroup: (group: AgentHubGroupNode, collapsed: boolean) => void
  selectedKey: string | null
  now: number
  selectionMode?: boolean
  onToggleChildren?: (key: string) => void
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  onOpen: (row: AgentHubTerminalRow) => void
  onPopout: (row: AgentHubTerminalRow) => void
  onJump: (row: AgentHubTerminalRow) => void
  onMarkRead?: (row: AgentHubTerminalRow) => void
  sortByHost?: boolean
  onSortByHostChange?: (value: boolean) => void
}): React.JSX.Element {
  const listId = useId()
  const isSleeping = useAgentHubSleepingTargetTest()
  const hostLabels = new Map((windowFilter?.host?.options ?? []).map((o) => [o.id, o.label]))
  const trimmedQuery = query.trim()
  const rowContext: TreeRowContext = {
    lineage,
    selectionMode,
    selectionListId: selectionMode ? listId : undefined,
    onToggleChildren,
    expandedKeys,
    narrowed: isAgentHubTreeNarrowed(
      query,
      windowFilter?.value,
      windowFilter?.host?.value,
      Boolean(windowFilter?.toggles?.unreadOnly || windowFilter?.toggles?.botStartedOnly) ||
        stateFiltered
    ),
    selectedKey,
    now,
    isSleeping,
    onOpen,
    onPopout,
    onJump,
    onMarkRead
  }
  const botHits = trimmedQuery
    ? (botChats?.tallies ?? []).filter((tally) =>
        tally.bot.name.toLowerCase().includes(trimmedQuery.toLowerCase())
      )
    : []
  const botChatTotal = (botChats?.tallies ?? []).reduce((sum, tally) => sum + tally.chats, 0)
  return (
    <div>
      {/* Why the popover color and shadow: the sticky row must hide rows scrolling under it. */}
      <div className="sticky top-0 z-[2] mt-0.5 mb-1 flex flex-col gap-1.5 bg-popover shadow-[0_-8px_0_var(--popover)]">
        <div className="flex items-center gap-1.5">
          <label className="flex h-8.5 min-w-0 flex-1 items-center gap-2 rounded-lg border border-foreground/[0.08] bg-background pr-1.5 pl-2.5 text-muted-foreground/70 focus-within:border-foreground/20">
            <Search className="size-3.5 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              data-agent-hub-search
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                // The popover keeps itself open for this Esc (see AgentHubRoot).
                if (event.key === 'Escape' && query) {
                  onQueryChange('')
                }
              }}
              placeholder={
                windowFilter
                  ? translate('agentHub.terminals.searchHub', 'Search agents, projects, bots')
                  : translate(
                      'agentHub.terminals.searchPlaceholder',
                      'Filter by terminal, project, group, or agent'
                    )
              }
              aria-label={translate('agentHub.terminals.searchLabel', 'Filter terminals')}
              aria-controls={selectionMode ? listId : undefined}
              aria-activedescendant={
                selectionMode && selectedKey ? `${listId}-${selectedKey}` : undefined
              }
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <HubKeys keys={[String(totalCount)]} />
          </label>
          {windowFilter ? (
            <AgentHubWindowFilterMenu
              filter={windowFilter.value}
              onFilterChange={windowFilter.onChange}
              host={windowFilter.host}
              toggles={windowFilter.toggles}
              onClosed={() => searchRef.current?.focus()}
            />
          ) : null}
          <AgentHubTerminalSortMenu
            focusable={selectionMode}
            sortBy={sortBy}
            onSortChange={onSortChange}
            byHost={
              onSortByHostChange
                ? { value: Boolean(sortByHost), onChange: onSortByHostChange }
                : undefined
            }
            onClosed={() => searchRef.current?.focus()}
          />
        </div>
        {filterBar}
      </div>
      {groups.length === 0 && emptyState && !trimmedQuery ? emptyState : null}
      {groups.length === 0 && botHits.length === 0 && !(emptyState && !trimmedQuery) ? (
        <div className="flex flex-col items-center gap-1 px-2.5 pt-5.5 pb-4.5 text-center text-xs text-muted-foreground">
          <b className="text-[13px] font-medium text-foreground/85">
            {trimmedQuery
              ? translate('agentHub.terminals.noMatch', 'No terminal matches “{{value0}}”', {
                  value0: trimmedQuery
                })
              : ((windowFilter && agentHubWindowFilterOption(windowFilter.value).emptyLabel()) ??
                emptyLabel ??
                translate('agentHub.terminals.empty', 'No open terminals'))}
          </b>
          {trimmedQuery ? (
            <span>
              {translate(
                'agentHub.terminals.noMatchHint',
                'Try a project, group, branch or agent name'
              )}
            </span>
          ) : null}
        </div>
      ) : null}
      <AgentHubBotSearchHits hits={botHits} onOpen={(key) => botChats?.onOpenBots(key)} />
      <div
        id={selectionMode ? listId : undefined}
        role={selectionMode ? 'listbox' : undefined}
        aria-label={
          selectionMode ? translate('agentHub.mirror.available', 'Available terminals') : undefined
        }
      >
        {groups.map((group) => {
          const collapsed = isAgentHubGroupCollapsed(
            group,
            collapseOverrides,
            rowContext.narrowed,
            foldSleeping
          )
          return (
            <section key={group.key} className="mt-1">
              <AgentHubGroupContextMenu
                group={group}
                isSleeping={isSleeping}
                enabled={
                  group.key !== AGENT_HUB_SLEEPING_GROUP && group.key !== AGENT_HUB_BOTS_GROUP
                }
                onCollapseOthers={() =>
                  groups.forEach((other) => other !== group && onToggleGroup(other, true))
                }
              >
                <button
                  type="button"
                  tabIndex={selectionMode ? 0 : -1}
                  onKeyDown={(event) => {
                    if (
                      selectionMode &&
                      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                    ) {
                      event.preventDefault()
                      event.stopPropagation()
                      onToggleGroup(group, event.key === 'ArrowLeft')
                    }
                  }}
                  aria-expanded={!collapsed}
                  onClick={() => onToggleGroup(group, !collapsed)}
                  className="flex w-full items-center gap-2 rounded-lg bg-foreground/[0.03] px-2 py-2 text-left text-xs font-semibold text-foreground/85 select-none hover:bg-foreground/[0.05]"
                >
                  <HubFoldChevron open={!collapsed} className="size-3.5 text-muted-foreground/70" />
                  <span className="min-w-0 truncate">{group.label}</span>
                  <GroupSummary group={group} />
                </button>
              </AgentHubGroupContextMenu>
              <HubCollapse open={!collapsed}>
                {group.workspaces.map((workspace) => (
                  <div key={workspace.key}>
                    <div className="group/workspace flex flex-wrap items-center gap-1.5 pt-1.5 pr-2 pb-1 pl-7 text-xs text-muted-foreground/70">
                      <Folder className="size-3 shrink-0" />
                      <span className="truncate">{workspace.projectLabel}</span>
                      {workspace.workspaceLabel ? (
                        <>
                          <span>·</span>
                          <GitBranch className="size-3 shrink-0" />
                          <span className="truncate">{workspace.workspaceLabel}</span>
                        </>
                      ) : null}
                      <WorkspaceHostBadge
                        label={hostLabels.get(getWorktreeHostIdentity(workspace.worktree))}
                      />
                      {selectionMode && workspace.bot && !workspace.bot.home ? (
                        <HubChip>
                          {translate('agentHub.terminals.byBot', 'by {{name}}', {
                            name: workspace.bot.bot.name
                          })}
                        </HubChip>
                      ) : null}
                      {renderWorkspaceAction ? (
                        <div className="ml-auto">{renderWorkspaceAction(workspace)}</div>
                      ) : null}
                    </div>
                    {workspace.rows.map((row) => (
                      <TreeRow key={row.key} row={row} nested={false} context={rowContext} />
                    ))}
                    {workspace.idleFold && onToggleIdle ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-expanded={workspace.idleFold.open}
                        onClick={() => onToggleIdle(workspace.key)}
                        className="flex w-full items-center gap-1.5 py-1 pr-2 pl-9 text-left text-xs text-muted-foreground/70 hover:text-foreground"
                      >
                        <HubFoldChevron open={workspace.idleFold.open} className="size-3" />
                        {translate('agentHub.terminals.idleFold', '{{count}} idle', {
                          count: workspace.idleFold.count
                        })}
                      </button>
                    ) : null}
                  </div>
                ))}
              </HubCollapse>
            </section>
          )
        })}
      </div>
      {botChats && botChatTotal > 0 && !trimmedQuery ? (
        <AgentHubBotChatsLine tallies={botChats.tallies} onOpen={() => botChats.onOpenBots(null)} />
      ) : null}
    </div>
  )
}
