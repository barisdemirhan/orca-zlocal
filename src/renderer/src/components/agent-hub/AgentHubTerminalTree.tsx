import { useId } from 'react'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { Folder, GitBranch, Search } from 'lucide-react'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { HubChip, HubKeys } from './AgentHubInlineLabels'
import { HubCollapse, HubFoldChevron } from './AgentHubFold'
import { HubCounts } from './AgentHubStateMarks'
import { AgentHubChildGroup } from './AgentHubChildGroup'
import { AgentHubRow } from './AgentHubRow'
import { closeAgentHubAgent } from './agent-hub-close-agent'
import { AgentHubTerminalSortMenu } from './AgentHubTerminalSortMenu'
import { AgentHubWindowFilterMenu } from './AgentHubWindowFilterMenu'
import type { AgentHubHostFilter } from './use-agent-hub-host-filter'
import { agentHubWindowFilterOption, type AgentHubWindowFilter } from './agent-hub-window-filter'
import { agentHubStateWord } from './agent-hub-copy'
import { useAgentHubSleepingTargetTest } from './agent-hub-pane-sleep'
import { WorktreeHostContextBadge } from '@/components/sidebar/workspace-card/host/WorktreeHostContextBadge'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import {
  agentHubIndicatorKind,
  agentHubStateSince,
  agentHubToolName,
  type AgentHubIndicatorKind
} from './agent-hub-lists'
import type { AgentHubLineage } from './agent-hub-lineage'
import type {
  AgentHubGroupNode,
  AgentHubTerminalRow,
  AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'
import {
  isAgentHubGroupCollapsed,
  isAgentHubRowExpanded,
  isAgentHubTreeNarrowed
} from './agent-hub-terminal-tree-view'

function rowKind(row: AgentHubTerminalRow): AgentHubIndicatorKind {
  return row.thread ? agentHubIndicatorKind(row.thread) : 'idle'
}

function rowSubtitle(row: AgentHubTerminalRow, sleeping: boolean): string {
  const agent = row.thread?.agentType ?? row.idleAgent
  const who = agent ? `@${agent}` : translate('agentHub.terminals.shell', 'shell')
  const state = sleeping
    ? translate('agentHub.sleep.group', 'Sleeping')
    : agentHubStateWord(row.thread)
  return `${who} · ${state}`
}

function WorkspaceHostBadge({ label }: { label: string | undefined }): React.JSX.Element | null {
  return label ? <WorktreeHostContextBadge label={label} /> : null
}

function GroupSummary({ group }: { group: AgentHubGroupNode }): React.JSX.Element {
  return (
    <span className="ml-auto flex items-center gap-2.5 font-mono text-[11px] font-normal text-muted-foreground/70">
      <HubCounts counts={group.counts} />
      <span>
        {translate('agentHub.terminals.termCount', '{{value0}} term', {
          value0: group.rowCount
        })}
      </span>
    </span>
  )
}

type TreeRowContext = {
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  /** A search or filter narrows the list, so every fold opens. */
  narrowed: boolean
  selectedKey: string | null
  now: number
  isSleeping: (target: AgentHubPaneTarget) => boolean
  selectionMode?: boolean
  selectionListId?: string
  onToggleChildren?: (key: string) => void
  onOpen: (row: AgentHubTerminalRow) => void
  onPopout: (row: AgentHubTerminalRow) => void
  onJump: (row: AgentHubTerminalRow) => void
}

/** A terminal row, then (when it dispatched workers or runs subagents) their fold. */
function TreeRow({
  row,
  nested,
  context
}: {
  row: AgentHubTerminalRow
  nested: boolean
  context: TreeRowContext
}): React.JSX.Element {
  const { now } = context
  const kind = rowKind(row)
  const sleeping = context.isSleeping(paneTargetFromTerminalRow(row))
  const tool = row.thread && kind === 'work' ? agentHubToolName(row.thread) : null
  const subagents =
    !context.selectionMode && row.paneKey ? context.lineage.childrenOf(row.paneKey).subagents : []
  return (
    <>
      <AgentHubRow
        selectionMode={context.selectionMode}
        optionId={context.selectionListId ? `${context.selectionListId}-${row.key}` : undefined}
        kind={kind}
        agentType={row.thread?.agentType ?? row.idleAgent}
        title={row.title}
        subtitle={rowSubtitle(row, sleeping)}
        sleeping={sleeping}
        worktreeId={row.worktree.id}
        chips={
          kind === 'ask' && row.thread ? (
            <HubChip tone="ask">{agentHubStateWord(row.thread)}</HubChip>
          ) : tool ? (
            <HubChip>{tool}</HubChip>
          ) : null
        }
        time={row.thread ? formatShortTimeAgo(agentHubStateSince(row.thread), now) : undefined}
        selected={row.key === context.selectedKey}
        indent={!nested}
        // Same key the mirror store gives this row's target (see agentHubPaneTargetKey).
        mirrorKey={row.paneKey ?? row.tab.id}
        mirrorTarget={paneTargetFromTerminalRow(row)}
        onOpen={() => context.onOpen(row)}
        onPopout={() => context.onPopout(row)}
        onJump={() => context.onJump(row)}
        onClose={() => closeAgentHubAgent(paneTargetFromTerminalRow(row), kind)}
      />
      <AgentHubChildGroup
        onToggle={context.onToggleChildren ? () => context.onToggleChildren?.(row.key) : undefined}
        parentKey={row.key}
        childAgents={{
          workers: row.children.flatMap((child) => child.thread ?? []),
          subagents
        }}
        expanded={isAgentHubRowExpanded(row.key, context.expandedKeys, context.narrowed)}
        indent={!nested}
        now={now}
        focusable={context.selectionMode}
        onOpenParent={() => context.onOpen(row)}
      >
        {row.children.map((child) => (
          <TreeRow key={child.key} row={child} nested context={context} />
        ))}
      </AgentHubChildGroup>
    </>
  )
}

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
  selectionMode = false,
  onToggleChildren,
  emptyLabel,
  windowFilter,
  renderWorkspaceAction,
  filterBar,
  emptyState
}: {
  groups: readonly AgentHubGroupNode[]
  renderWorkspaceAction?: (workspace: AgentHubWorkspaceNode) => React.ReactNode
  totalCount: number
  emptyLabel?: string
  /** Sits under the search row, inside the sticky header. */
  filterBar?: React.ReactNode
  /** Replaces the empty message when nothing is left and no search is typed. */
  emptyState?: React.ReactNode
  /** Shows the window filter beside the sort; the hub's lists have it, the picker does not. */
  windowFilter?: {
    value: AgentHubWindowFilter
    onChange: (filter: AgentHubWindowFilter) => void
    host?: Pick<AgentHubHostFilter, 'value' | 'options' | 'onChange'>
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
    narrowed: isAgentHubTreeNarrowed(query, windowFilter?.value, windowFilter?.host?.value),
    selectedKey,
    now,
    isSleeping,
    onOpen,
    onPopout,
    onJump
  }
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
              placeholder={translate(
                'agentHub.terminals.searchPlaceholder',
                'Filter by terminal, project, group, agent…'
              )}
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
              onClosed={() => searchRef.current?.focus()}
            />
          ) : null}
          <AgentHubTerminalSortMenu
            focusable={selectionMode}
            sortBy={sortBy}
            onSortChange={onSortChange}
            onClosed={() => searchRef.current?.focus()}
          />
        </div>
        {filterBar}
      </div>
      {groups.length === 0 && emptyState && !trimmedQuery ? emptyState : null}
      {groups.length === 0 && !(emptyState && !trimmedQuery) ? (
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
      <div
        id={selectionMode ? listId : undefined}
        role={selectionMode ? 'listbox' : undefined}
        aria-label={
          selectionMode ? translate('agentHub.mirror.available', 'Available terminals') : undefined
        }
      >
        {groups.map((group) => {
          const collapsed = isAgentHubGroupCollapsed(group, collapseOverrides, rowContext.narrowed)
          return (
            <section key={group.key} className="mt-1">
              <button
                type="button"
                tabIndex={selectionMode ? 0 : -1}
                onKeyDown={(event) => {
                  if (selectionMode && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
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
                      {renderWorkspaceAction ? (
                        <div className="ml-auto">{renderWorkspaceAction(workspace)}</div>
                      ) : null}
                    </div>
                    {workspace.rows.map((row) => (
                      <TreeRow key={row.key} row={row} nested={false} context={rowContext} />
                    ))}
                  </div>
                ))}
              </HubCollapse>
            </section>
          )
        })}
      </div>
    </div>
  )
}
