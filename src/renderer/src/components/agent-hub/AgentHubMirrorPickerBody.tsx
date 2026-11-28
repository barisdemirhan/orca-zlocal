import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNow } from '@/lib/window-activity/use-now'
import { useNearestAgentHubSelection } from './agent-hub-nearest-row'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import { availableAgentHubPickerParents } from './agent-hub-picker-tree'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'
import { useAgentHubTreeOrder } from './use-agent-hub-tree-order'
import { useHeldAgentHubTree } from './use-held-agent-hub-tree'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { isAgentHubTreeNarrowed, visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'
import { sortAgentHubTerminalTree } from './agent-hub-terminal-tree-sort'
import { moveAgentHubSelection } from './agent-hub-keys'
import { AgentHubTerminalTree } from './AgentHubTerminalTree'
import { AgentHubTabSwitcher, agentHubTabSwitcherPanelProps } from './AgentHubTabSwitcher'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  activeAgentHubMirrorTab,
  homeAgentHubMirrorTab,
  agentHubMirrorWindows
} from './agent-hub-mirror-membership'
import { AgentHubMirrorNewAgent } from './AgentHubMirrorNewAgent'
import { Button } from '@/components/ui/button'
import { AgentHubPickerFilters } from './AgentHubPickerFilters'
import { countAgentHubTreeRows, useAgentHubPickerFilters } from './use-agent-hub-picker-filters'
import { useAgentHubHostLabels } from './use-agent-hub-host-labels'

const PICKER_TAB_ID = 'agent-hub-picker'
const PICKER_SECTIONS = ['agents', 'all'] as const

export function AgentHubMirrorPickerBody({
  windowId,
  pending,
  onStart,
  onOpenNewAgent,
  threads,
  lineage,
  onAdd,
  onClose,
  query,
  onQueryChange,
  searchRef
}: {
  windowId: string
  pending: boolean
  onStart: (worktree: Worktree, agent: TuiAgent) => void
  onOpenNewAgent: (worktree: Worktree) => void
  threads: readonly AgentPaneThread[]
  lineage: AgentHubLineage
  onAdd: (row: AgentHubTerminalRow) => void
  onClose: () => void
  query: string
  onQueryChange: (value: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
}): React.JSX.Element {
  const [section, setSection] = useState<'agents' | 'all'>('agents')
  const [sortBy, setSortBy] = useState<AgentHubTerminalSort>('smart')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const mirrors = useAgentHubMirrors()
  const mirror = agentHubMirrorWindows(mirrors).find((entry) => entry.id === windowId)
  const homeWorktree =
    mirror && homeAgentHubMirrorTab(activeAgentHubMirrorTab(mirror)).target.worktree
  const parentOf = useMemo(
    () => availableAgentHubPickerParents(lineage.parentOf, threads, mirrors),
    [lineage.parentOf, threads, mirrors]
  )
  const tree = useAgentHubTerminalTree(threads, true, parentOf)
  const hostLabels = useAgentHubHostLabels()
  const filters = useAgentHubPickerFilters({
    tree,
    mirrors,
    hostLabels,
    windowWorktrees: mirror?.tabs.map((tab) => tab.target.worktree) ?? [],
    section,
    query,
    onSelectionChange: () => setSelectedKey(null)
  })
  const { available, agentTree, sectionTree, queried } = filters
  const order = useAgentHubTreeOrder(sectionTree, sortBy)
  const sorted = useMemo(() => sortAgentHubTerminalTree(queried, order), [queried, order])
  const groups = useHeldAgentHubTree(
    sorted,
    `${section}\u0000${sortBy}\u0000${query}\u0000${[...filters.projectKeys].join('\u0001')}\u0000${[...filters.botKeys].join('\u0001')}`
  )
  const showAllFilters = (): void => {
    filters.clear()
    searchRef.current?.focus()
  }
  const rows = useMemo(
    () => visibleAgentHubTreeRows(groups, collapsed, isAgentHubTreeNarrowed(query), expanded),
    [groups, collapsed, query, expanded]
  )
  const rowKeys = useMemo(() => rows.map((row) => row.key), [rows])
  useNearestAgentHubSelection(rowKeys, selectedKey, setSelectedKey)
  const now = useNow(30_000)
  const totalCount = countAgentHubTreeRows(sectionTree)
  useEffect(() => {
    rootRef.current
      ?.querySelector('[data-agent-hub-row][data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey])
  return (
    <div
      ref={rootRef}
      data-agent-hub-picker
      onKeyDown={(event) => {
        if (
          event.isPropagationStopped() ||
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey
        ) {
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          if (query) {
            onQueryChange('')
          } else {
            onClose()
          }
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (
            event.target !== searchRef.current &&
            event.target instanceof HTMLElement &&
            event.target.closest('button')
          ) {
            return
          }
          event.preventDefault()
          const index = rows.findIndex((row) => row.key === selectedKey)
          setSelectedKey(
            rows[moveAgentHubSelection(index, event.key === 'ArrowDown' ? 1 : -1, rows.length)]
              ?.key ?? null
          )
        } else if (event.key === 'Enter' && event.target === searchRef.current) {
          const selected =
            rows.find((row) => row.key === selectedKey) ?? (query.trim() ? rows[0] : undefined)
          if (selected) {
            event.preventDefault()
            onAdd(selected)
          }
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-2.5">
        {homeWorktree ? (
          <AgentHubMirrorNewAgent
            worktree={homeWorktree}
            pending={pending}
            onStart={onStart}
            onOpenDialog={onOpenNewAgent}
          />
        ) : null}
        <AgentHubTabSwitcher
          tabs={PICKER_SECTIONS.map((value) => ({
            value,
            label:
              value === 'agents'
                ? translate('agentHub.tab.agents', 'Agents')
                : translate('agentHub.tab.all', 'All terminals')
          }))}
          value={section}
          ariaLabel={translate('agentHub.mirror.pickerSections', 'Terminal lists')}
          focusIdPrefix={PICKER_TAB_ID}
          counts={{
            agents: countAgentHubTreeRows(agentTree),
            all: countAgentHubTreeRows(available)
          }}
          onChange={(value) => {
            setSection(value)
            setSelectedKey(null)
          }}
        />
      </div>
      <div
        {...agentHubTabSwitcherPanelProps(PICKER_TAB_ID, section)}
        className="max-h-[min(520px,calc(100vh-160px))] overflow-y-auto px-2.5 pb-2.5 scrollbar-sleek"
      >
        <AgentHubTerminalTree
          renderWorkspaceAction={(workspace) => (
            <AgentHubMirrorNewAgent
              worktree={workspace.worktree}
              workspaceHeader
              pending={pending}
              onStart={onStart}
            />
          )}
          groups={groups}
          totalCount={totalCount}
          query={query}
          searchRef={searchRef}
          onQueryChange={(value) => {
            onQueryChange(value)
            setSelectedKey(null)
          }}
          sortBy={sortBy}
          onSortChange={(value) => {
            setSortBy(value)
            setSelectedKey(null)
          }}
          collapseOverrides={collapsed}
          onToggleGroup={(group, value) =>
            setCollapsed((current) => new Map(current).set(group.key, value))
          }
          emptyLabel={translate('agentHub.mirror.noneAvailable', 'No terminals available to add')}
          filterBar={
            <AgentHubPickerFilters
              projects={filters.projects}
              bots={filters.bots}
              selectedProjects={filters.projectKeys}
              selectedBots={filters.botKeys}
              onProjectsChange={filters.changeProjects}
              onBotsChange={filters.changeBots}
              onClear={filters.clear}
              onClosed={() => searchRef.current?.focus()}
            />
          }
          emptyState={
            filters.active ? (
              <div
                data-agent-hub-project-empty
                className="flex flex-col items-center gap-2.5 px-2.5 pt-5.5 pb-4.5 text-center text-xs text-muted-foreground"
              >
                <b className="text-[13px] font-medium text-foreground/85">
                  {translate(
                    'agentHub.mirror.projectFilter.emptyFiltered',
                    'Nothing else to add with these filters'
                  )}
                </b>
                <div className="flex items-center gap-2">
                  {homeWorktree ? (
                    <AgentHubMirrorNewAgent
                      worktree={homeWorktree}
                      pending={pending}
                      onStart={onStart}
                      onOpenDialog={onOpenNewAgent}
                    />
                  ) : null}
                  <Button type="button" variant="outline" size="xs" onClick={showAllFilters}>
                    {translate('agentHub.mirror.projectFilter.showAll', 'Show all')}
                  </Button>
                </div>
              </div>
            ) : undefined
          }
          selectedKey={rows.some((row) => row.key === selectedKey) ? selectedKey : null}
          now={now}
          lineage={lineage}
          expandedKeys={expanded}
          selectionMode
          onToggleChildren={(key) =>
            setExpanded((current) => {
              const next = new Set(current)
              if (next.has(key)) {
                next.delete(key)
              } else {
                next.add(key)
              }
              return next
            })
          }
          onOpen={onAdd}
          onPopout={onAdd}
          onJump={onAdd}
        />
        {filters.outsideCount > 0 && groups.length > 0 ? (
          <div
            data-agent-hub-project-outside
            className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground"
          >
            {translate(
              'agentHub.mirror.projectFilter.outside',
              '{{value0}} more outside the filter',
              {
                value0: filters.outsideCount
              }
            )}
            <span aria-hidden>·</span>
            <Button type="button" variant="link" size="xs" onClick={showAllFilters}>
              {translate('agentHub.mirror.projectFilter.showAll', 'Show all')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
