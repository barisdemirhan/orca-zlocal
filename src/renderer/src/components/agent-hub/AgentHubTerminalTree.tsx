import { ChevronDown, ChevronRight, Folder, GitBranch, Search } from 'lucide-react'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { AgentQuestionIcon } from '@/components/AgentQuestionIcon'
import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { translate } from '@/i18n/i18n'
import { threadAgentStateLabel } from '../activity/activity-thread-presentation'
import { AgentHubRow } from './AgentHubRow'
import { agentHubStateSince } from './agent-hub-lists'
import {
  isAgentHubGroupCollapsed,
  type AgentHubGroupNode,
  type AgentHubTerminalRow
} from './agent-hub-terminal-tree'

export function AgentHubTerminalTree({
  groups,
  query,
  onQueryChange,
  searchRef,
  collapseOverrides,
  onToggleGroup,
  selectedKey,
  now,
  onPopout,
  onJump
}: {
  groups: readonly AgentHubGroupNode[]
  query: string
  onQueryChange: (query: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  collapseOverrides: ReadonlyMap<string, boolean>
  onToggleGroup: (group: AgentHubGroupNode, collapsed: boolean) => void
  selectedKey: string | null
  now: number
  onPopout: (row: AgentHubTerminalRow) => void
  onJump: (row: AgentHubTerminalRow) => void
}): React.JSX.Element {
  return (
    <div>
      <label className="sticky top-0 z-10 mb-1 flex h-8 items-center gap-2 rounded-md border border-input bg-popover px-2 text-muted-foreground focus-within:border-ring">
        <Search className="size-3.5 shrink-0" />
        <input
          ref={searchRef}
          value={query}
          data-agent-hub-search
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            // The popover keeps itself open for this Esc (see AgentHubStatusSegment).
            if (event.key === 'Escape' && query) {
              onQueryChange('')
            }
          }}
          placeholder={translate(
            'agentHub.terminals.searchPlaceholder',
            'Filter by terminal, project, group, or agent'
          )}
          aria-label={translate('agentHub.terminals.searchLabel', 'Filter terminals')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </label>
      {groups.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          {query.trim()
            ? translate('agentHub.terminals.noMatch', 'No terminal matches “{{value0}}”', {
                value0: query.trim()
              })
            : translate('agentHub.terminals.empty', 'No open terminals')}
        </p>
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
              className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-semibold text-foreground/85 hover:bg-accent"
            >
              {collapsed ? (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              <span className="flex shrink-0 items-center gap-2 text-[11px] font-normal text-muted-foreground tabular-nums">
                {group.counts.needsYou > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <AgentQuestionIcon className="size-2.5" />
                    {group.counts.needsYou}
                  </span>
                ) : null}
                {group.counts.working > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <AgentWorkingSpinner className="size-1.5" />
                    {group.counts.working}
                  </span>
                ) : null}
                <span>
                  {group.rowCount === 1
                    ? translate('agentHub.terminals.groupCountOne', '1 terminal')
                    : translate('agentHub.terminals.groupCount', '{{value0}} terminals', {
                        value0: group.rowCount
                      })}
                </span>
              </span>
            </button>
            {collapsed
              ? null
              : group.workspaces.map((workspace) => (
                  <div key={workspace.key}>
                    <div className="flex items-center gap-1.5 py-1 pr-2 pl-6 text-[11px] text-muted-foreground">
                      <Folder className="size-3 shrink-0" />
                      <span className="truncate">{workspace.projectLabel}</span>
                      {workspace.workspaceLabel ? (
                        <>
                          <GitBranch className="size-3 shrink-0" />
                          <span className="truncate">{workspace.workspaceLabel}</span>
                        </>
                      ) : null}
                    </div>
                    {workspace.rows.map((row) => (
                      <AgentHubRow
                        key={row.key}
                        thread={row.thread}
                        agentType={row.thread?.agentType ?? null}
                        title={row.title}
                        subtitle={
                          row.thread
                            ? threadAgentStateLabel(row.thread)
                            : translate('agentHub.terminals.shell', 'Shell')
                        }
                        trailing={
                          row.thread
                            ? formatShortTimeAgo(agentHubStateSince(row.thread), now)
                            : null
                        }
                        selected={row.key === selectedKey}
                        indent
                        onPopout={() => onPopout(row)}
                        onJump={() => onJump(row)}
                      />
                    ))}
                  </div>
                ))}
          </section>
        )
      })}
    </div>
  )
}
