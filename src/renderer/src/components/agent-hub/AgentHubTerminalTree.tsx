import { paneTargetFromTerminalRow } from './agent-hub-pane-target'
import { Folder, GitBranch, Search } from 'lucide-react'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { HubChip, HubCollapse, HubCounts, HubFoldChevron, HubKeys } from './AgentHubAtoms'
import { AgentHubChildGroup } from './AgentHubChildGroup'
import { AgentHubRow } from './AgentHubRow'
import { AgentHubTerminalSortMenu } from './AgentHubTerminalSortMenu'
import { agentHubStateWord } from './agent-hub-copy'
import {
  agentHubIndicatorKind,
  agentHubStateSince,
  agentHubToolName,
  type AgentHubIndicatorKind
} from './agent-hub-lists'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { isAgentHubGroupCollapsed, isAgentHubRowExpanded } from './agent-hub-terminal-tree-view'

function rowKind(row: AgentHubTerminalRow): AgentHubIndicatorKind {
  return row.thread ? agentHubIndicatorKind(row.thread) : 'idle'
}

function rowSubtitle(row: AgentHubTerminalRow): string {
  const agent = row.thread?.agentType ?? row.idleAgent
  const who = agent ? `@${agent}` : translate('agentHub.terminals.shell', 'shell')
  return `${who} · ${agentHubStateWord(row.thread)}`
}

function GroupSummary({ group }: { group: AgentHubGroupNode }): React.JSX.Element {
  return (
    <span className="ml-auto flex items-center gap-[9px] font-mono text-[11px] font-normal text-muted-foreground/70">
      <HubCounts counts={group.counts} />
      <span>
        {translate('agentHub.terminals.termCount', '{{value0}} term', { value0: group.rowCount })}
      </span>
    </span>
  )
}

type TreeRowContext = {
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  query: string
  selectedKey: string | null
  now: number
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
  const tool = row.thread && kind === 'work' ? agentHubToolName(row.thread) : null
  const subagents = row.paneKey ? context.lineage.childrenOf(row.paneKey).subagents : []
  return (
    <>
      <AgentHubRow
        kind={kind}
        agentType={row.thread?.agentType ?? row.idleAgent}
        title={row.title}
        subtitle={rowSubtitle(row)}
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
      />
      <AgentHubChildGroup
        parentKey={row.key}
        childAgents={{ workers: row.children.flatMap((child) => child.thread ?? []), subagents }}
        expanded={isAgentHubRowExpanded(row.key, context.expandedKeys, context.query)}
        indent={!nested}
        now={now}
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
  onJump
}: {
  groups: readonly AgentHubGroupNode[]
  totalCount: number
  query: string
  onQueryChange: (query: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  sortBy: AgentHubTerminalSort
  onSortChange: (sortBy: AgentHubTerminalSort) => void
  collapseOverrides: ReadonlyMap<string, boolean>
  onToggleGroup: (group: AgentHubGroupNode, collapsed: boolean) => void
  selectedKey: string | null
  now: number
  lineage: AgentHubLineage
  expandedKeys: ReadonlySet<string>
  onOpen: (row: AgentHubTerminalRow) => void
  onPopout: (row: AgentHubTerminalRow) => void
  onJump: (row: AgentHubTerminalRow) => void
}): React.JSX.Element {
  const trimmedQuery = query.trim()
  const rowContext: TreeRowContext = {
    lineage,
    expandedKeys,
    query,
    selectedKey,
    now,
    onOpen,
    onPopout,
    onJump
  }
  return (
    <div>
      {/* Why the popover color and shadow: the sticky row must hide rows scrolling under it. */}
      <div className="sticky top-0 z-[2] mt-0.5 mb-1 flex items-center gap-1.5 bg-popover shadow-[0_-8px_0_var(--popover)]">
        <label className="flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-foreground/[0.08] bg-background pr-1.5 pl-2.5 text-muted-foreground/70 focus-within:border-foreground/20">
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
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <HubKeys keys={[String(totalCount)]} />
        </label>
        <AgentHubTerminalSortMenu
          sortBy={sortBy}
          onSortChange={onSortChange}
          onClosed={() => searchRef.current?.focus()}
        />
      </div>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-2.5 pt-[22px] pb-[18px] text-center text-xs text-muted-foreground">
          <b className="text-[13px] font-medium text-foreground/85">
            {trimmedQuery
              ? translate('agentHub.terminals.noMatch', 'No terminal matches “{{value0}}”', {
                  value0: trimmedQuery
                })
              : translate('agentHub.terminals.empty', 'No open terminals')}
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
      {groups.map((group) => {
        const collapsed = isAgentHubGroupCollapsed(group, collapseOverrides, query)
        return (
          <section key={group.key} className="mt-1">
            <button
              type="button"
              tabIndex={-1}
              aria-expanded={!collapsed}
              onClick={() => onToggleGroup(group, !collapsed)}
              className="flex w-full items-center gap-[7px] rounded-[10px] bg-foreground/[0.03] px-2 py-[7px] text-left text-xs font-semibold text-foreground/85 select-none hover:bg-foreground/[0.05]"
            >
              <HubFoldChevron open={!collapsed} className="size-[13px] text-muted-foreground/70" />
              <span className="min-w-0 truncate">{group.label}</span>
              <GroupSummary group={group} />
            </button>
            <HubCollapse open={!collapsed}>
              {group.workspaces.map((workspace) => (
                <div key={workspace.key}>
                  <div className="flex items-center gap-[5px] pt-[5px] pr-2 pb-[3px] pl-7 text-[11.5px] text-muted-foreground/70">
                    <Folder className="size-3 shrink-0" />
                    <span className="truncate">{workspace.projectLabel}</span>
                    {workspace.workspaceLabel ? (
                      <>
                        <span>·</span>
                        <GitBranch className="size-[11px] shrink-0" />
                        <span className="truncate">{workspace.workspaceLabel}</span>
                      </>
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
  )
}
