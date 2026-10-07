import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import {
  availableAgentHubPickerParents,
  availableAgentHubPickerTree
} from './agent-hub-picker-tree'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'
import { useAgentHubTreeOrder } from './use-agent-hub-tree-order'
import { useHeldAgentHubTree } from './use-held-agent-hub-tree'
import { agentOnlyAgentHubTree, type AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { filterAgentHubTerminalTree, visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'
import { sortAgentHubTerminalTree } from './agent-hub-terminal-tree-sort'
import { moveAgentHubSelection } from './agent-hub-keys'
import { AgentHubTerminalTree } from './AgentHubTerminalTree'

export function AgentHubMirrorPickerBody({
  threads,
  lineage,
  onAdd,
  onClose,
  query,
  onQueryChange,
  searchRef
}: {
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
  const parentOf = useMemo(
    () => availableAgentHubPickerParents(lineage.parentOf, threads, mirrors),
    [lineage.parentOf, threads, mirrors]
  )
  const tree = useAgentHubTerminalTree(threads, true, parentOf)
  const available = useMemo(() => availableAgentHubPickerTree(tree, mirrors), [tree, mirrors])
  const agentTree = useMemo(() => agentOnlyAgentHubTree(available), [available])
  const sectionTree = section === 'agents' ? agentTree : available
  const order = useAgentHubTreeOrder(sectionTree, sortBy)
  const sorted = useMemo(
    () => sortAgentHubTerminalTree(filterAgentHubTerminalTree(sectionTree, query), order),
    [sectionTree, query, order]
  )
  const groups = useHeldAgentHubTree(sorted, `${section}\u0000${sortBy}\u0000${query}`)
  const rows = visibleAgentHubTreeRows(groups, collapsed, query, expanded)
  const now = useNow(30_000)
  const totalCount = sectionTree.reduce((count, group) => count + group.rowCount, 0)
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
          const selected = rows.find((row) => row.key === selectedKey)
          if (selected) {
            event.preventDefault()
            onAdd(selected)
          }
        }
      }}
    >
      <Tabs
        value={section}
        onValueChange={(value) => {
          if (value === 'agents' || value === 'all') {
            setSection(value)
            setSelectedKey(null)
          }
        }}
      >
        <TabsList aria-label={translate('agentHub.mirror.pickerSections', 'Terminal lists')}>
          <TabsTrigger value="agents">{translate('agentHub.tab.agents', 'Agents')}</TabsTrigger>
          <TabsTrigger value="all">{translate('agentHub.tab.all', 'All terminals')}</TabsTrigger>
        </TabsList>
        <TabsContent value={section}>
          <div className="max-h-80 overflow-y-auto scrollbar-sleek">
            <AgentHubTerminalTree
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
              emptyLabel={translate(
                'agentHub.mirror.noneAvailable',
                'No terminals available to add'
              )}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
