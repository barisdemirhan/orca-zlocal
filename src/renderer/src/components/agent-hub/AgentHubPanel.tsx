import { registerAgentHubSelectedTarget } from './agent-hub-active-target'
import { AgentHubShortcutsButton } from './AgentHubShortcutsDialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { isEditableTarget } from '@/lib/editable-target'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubTabSwitcher } from './AgentHubTabSwitcher'
import { HubNestedCount } from './AgentHubSectionHeader'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import { AgentHubPanelFooter, agentHubPopoutKeys } from './AgentHubPanelFooter'
import {
  AgentHubInboxBody,
  AgentHubRunningBody,
  type AgentHubThreadActions
} from './AgentHubPanelSections'
import { AgentHubTerminalTree } from './AgentHubTerminalTree'
import {
  moveAgentHubSelection,
  nextAgentHubTab,
  resolveAgentHubKeyAction,
  AGENT_HUB_TABS,
  type AgentHubTab
} from './agent-hub-keys'
import { useAgentHubExpandedChildren } from './agent-hub-child-expansion'
import { visibleAgentHubRunningThreads, type AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubLists } from './agent-hub-lists'
import {
  paneTargetFromTerminalRow,
  paneTargetFromThread,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import {
  agentOnlyAgentHubTree,
  type AgentHubGroupNode,
  type AgentHubTerminalRow
} from './agent-hub-terminal-tree'
import { useHeldAgentHubTree } from './use-held-agent-hub-tree'
import { sortAgentHubTerminalTree, type AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'
import { filterAgentHubTerminalTree, visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'

export type AgentHubOpenRequest = {
  target: AgentHubPaneTarget
  thread: AgentPaneThread | null
}

type HubItem = AgentHubOpenRequest & { key: string }

function threadItem(thread: AgentPaneThread): HubItem {
  return {
    key: thread.paneKey,
    thread,
    target: paneTargetFromThread(thread, activityThreadRowCopy(thread).taskTitle)
  }
}

function rowItem(row: AgentHubTerminalRow): HubItem {
  return { key: row.key, thread: row.thread, target: paneTargetFromTerminalRow(row) }
}

function tabLabel(tab: AgentHubTab): string {
  switch (tab) {
    case 'inbox':
      return translate('agentHub.tab.inbox', 'Inbox')
    case 'running':
      return translate('agentHub.tab.running', 'Running')
    case 'agents':
      return translate('agentHub.tab.agents', 'Agents')
    case 'all':
      return translate('agentHub.tab.all', 'All terminals')
  }
}

export function AgentHubPanel({
  lists,
  lineage,
  tree,
  treeOrder,
  onSortChange,
  terminalCount,
  locationOf,
  rootRef,
  onJump,
  onOpen,
  onPopout,
  onPopoutAll,
  onMarkRead,
  onClose,
  initialTab = 'inbox',
  onTabChange,
  initialPaneKey = null
}: {
  lists: AgentHubLists
  lineage: AgentHubLineage
  tree: readonly AgentHubGroupNode[]
  /** How the Agents and All terminals lists are ordered. */
  treeOrder: AgentHubTreeOrder
  onSortChange: (sortBy: AgentHubTerminalSort) => void
  terminalCount: number
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  rootRef: React.RefObject<HTMLDivElement | null>
  onJump: (request: AgentHubOpenRequest) => void
  /** A click on a row: opens the pane's mirror and closes the hub. */
  onOpen: (request: AgentHubOpenRequest) => void
  /** The pop-out button and Alt+Enter: opens the mirror and keeps the hub open. */
  onPopout: (request: AgentHubOpenRequest) => void
  /** "Pop out all" on the Running tab: every listed agent's mirror at once. */
  onPopoutAll: (requests: AgentHubOpenRequest[]) => void
  onMarkRead: (paneKeys: string[]) => void
  onClose: () => void
  initialTab?: AgentHubTab
  /** Reports the tab on show, so the dock can close the hub when it is clicked again. */
  onTabChange?: (tab: AgentHubTab) => void
  /** Opens the Inbox on this waiting agent's card (an alert was clicked). */
  initialPaneKey?: string | null
}): React.JSX.Element {
  const [tab, setTab] = useState<AgentHubTab>(initialTab)
  // Why a pane key: a card can sort in ahead of the one being read (an approval's grace ending),
  // and a number key must still answer the card on screen. The index only places a replacement.
  const [cardFocus, setCardFocus] = useState(() => ({
    paneKey: initialPaneKey,
    index: Math.max(
      0,
      lists.needsYou.findIndex((thread) => thread.paneKey === initialPaneKey)
    )
  }))
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [query, setQuery] = useState('')
  const [collapseOverrides, setCollapseOverrides] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const cardControlRef = useRef<AgentHubCardControl>(null)
  const expandedKeys = useAgentHubExpandedChildren()
  const now = useNow(30_000)
  const popoutKeys = agentHubPopoutKeys()

  const needsYou = lists.needsYou
  const focusedCardIndex =
    cardFocus.paneKey === null
      ? -1
      : needsYou.findIndex((thread) => thread.paneKey === cardFocus.paneKey)
  const activeCardIndex =
    focusedCardIndex >= 0
      ? focusedCardIndex
      : Math.min(cardFocus.index, Math.max(0, needsYou.length - 1))
  const cardThread = needsYou[activeCardIndex] ?? null
  if (cardThread && cardThread.paneKey !== cardFocus.paneKey) {
    setCardFocus({ paneKey: cardThread.paneKey, index: activeCardIndex })
  }
  const agentTree = useMemo(() => agentOnlyAgentHubTree(tree), [tree])
  const agentCount = agentTree.reduce((total, group) => total + group.rowCount, 0)
  const listsTerminals = tab === 'agents' || tab === 'all'
  // Why sort after filtering: a group stands where its best listed workspace does.
  const sortedTree = useMemo(
    () =>
      sortAgentHubTerminalTree(
        filterAgentHubTerminalTree(tab === 'agents' ? agentTree : tree, query),
        treeOrder
      ),
    [tab, agentTree, tree, query, treeOrder]
  )
  const filteredTree = useHeldAgentHubTree(
    sortedTree,
    `${tab}\u0000${treeOrder.sortBy}\u0000${query}`
  )
  const items = useMemo<HubItem[]>(() => {
    if (tab === 'inbox') {
      return lists.finished.map(threadItem)
    }
    if (tab === 'running') {
      return visibleAgentHubRunningThreads(lists.working, lineage, expandedKeys).map(threadItem)
    }
    return visibleAgentHubTreeRows(filteredTree, collapseOverrides, query, expandedKeys).map(
      rowItem
    )
  }, [tab, lists, lineage, expandedKeys, filteredTree, collapseOverrides, query])
  const activeIndex = Math.min(selectedIndex, items.length - 1)
  const selectedKey = items[activeIndex]?.key ?? null
  const popoutTarget =
    items[activeIndex]?.target ??
    (tab === 'inbox' && cardThread ? threadItem(cardThread).target : null)
  useEffect(() => registerAgentHubSelectedTarget(popoutTarget), [popoutTarget])

  useEffect(() => {
    rootRef.current
      ?.querySelector('[data-agent-hub-row][data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey, rootRef])

  const switchTab = (next: AgentHubTab): void => {
    setTab(next)
    onTabChange?.(next)
    setSelectedIndex(-1)
    if (next === 'agents' || next === 'all') {
      requestAnimationFrame(() => searchRef.current?.focus())
    } else if (searchRef.current === document.activeElement) {
      rootRef.current?.focus()
    }
  }

  const pageCard = (delta: 1 | -1): void => {
    if (needsYou.length > 0) {
      const index = (activeCardIndex + delta + needsYou.length) % needsYou.length
      setCardFocus({ paneKey: needsYou[index]?.paneKey ?? null, index })
    }
  }

  const openItem = (item: HubItem | null, open: (request: AgentHubOpenRequest) => void): void => {
    if (item) {
      open({ target: item.target, thread: item.thread })
    }
  }
  const threadActions: AgentHubThreadActions = {
    locationOf,
    isSelected: (thread) => thread.paneKey === selectedKey,
    onJump: (thread) => openItem(threadItem(thread), onJump),
    onOpen: (thread) => openItem(threadItem(thread), onOpen),
    onPopout: (thread) => openItem(threadItem(thread), onPopout)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target instanceof HTMLElement ? event.target : null
    const action = resolveAgentHubKeyAction(event, {
      tab,
      inTextField: isEditableTarget(event.target),
      inSearch: target !== null && target === searchRef.current,
      onButton:
        target !== null && target !== event.currentTarget && target.closest('button') !== null,
      hasCard: cardThread !== null
    })
    if (!action) {
      return
    }
    switch (action.type) {
      case 'switchTab':
        switchTab(nextAgentHubTab(tab, action.direction))
        break
      case 'moveSelection':
        setSelectedIndex(moveAgentHubSelection(activeIndex, action.delta, items.length))
        break
      case 'pageCard':
        pageCard(action.delta)
        break
      case 'open':
        openItem(
          items[activeIndex] ?? (tab === 'inbox' && cardThread ? threadItem(cardThread) : null),
          action.popout ? onPopout : onJump
        )
        break
      case 'answer':
        if (!cardControlRef.current?.chooseOption(action.optionIndex)) {
          return
        }
        break
    }
    event.preventDefault()
  }

  const counts: Record<AgentHubTab, number> = {
    inbox: needsYou.length + lists.finished.length,
    running: lists.working.length,
    agents: agentCount,
    all: terminalCount
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex max-h-[min(640px,calc(100vh-96px))] min-h-0 flex-col outline-none"
    >
      <div className="flex shrink-0 items-center gap-3 pt-3.5 pr-3.5 pb-2.5 pl-4.5">
        <h2 className="shrink-0 text-sm font-semibold">{translate('agentHub.title', 'Agents')}</h2>
        <AgentHubTabSwitcher
          tabs={AGENT_HUB_TABS.map((value) => ({ value, label: tabLabel(value) }))}
          value={tab}
          onChange={switchTab}
          askValue={needsYou.length > 0 ? 'inbox' : undefined}
          counts={{
            inbox: counts.inbox,
            running: (
              <>
                {counts.running}
                <HubNestedCount value={lists.nestedWorking} />
              </>
            ),
            agents: counts.agents,
            all: counts.all
          }}
        />
        <AgentHubShortcutsButton />
        <button
          type="button"
          tabIndex={-1}
          aria-label={translate('agentHub.close', 'Close (esc)')}
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div
        // Why keyed: each tab fades in fresh instead of swapping content in place.
        key={tab}
        role="listbox"
        className="min-h-0 flex-1 animate-in overflow-y-auto px-2.5 pb-2.5 duration-150 scrollbar-sleek fade-in-0"
      >
        {tab === 'inbox' ? (
          <AgentHubInboxBody
            lists={lists}
            cardIndex={activeCardIndex}
            onPage={pageCard}
            now={now}
            popoutKeys={popoutKeys}
            cardControlRef={cardControlRef}
            actions={threadActions}
            onMarkRead={onMarkRead}
          />
        ) : null}
        {tab === 'running' ? (
          <AgentHubRunningBody
            working={lists.working}
            nestedWorking={lists.nestedWorking}
            now={now}
            lineage={lineage}
            expandedKeys={expandedKeys}
            actions={threadActions}
            onPopoutAll={() => onPopoutAll(items.map(({ target, thread }) => ({ target, thread })))}
          />
        ) : null}
        {listsTerminals ? (
          <AgentHubTerminalTree
            groups={filteredTree}
            totalCount={tab === 'agents' ? agentCount : terminalCount}
            query={query}
            onQueryChange={(value) => {
              setQuery(value)
              setSelectedIndex(-1)
            }}
            searchRef={searchRef}
            sortBy={treeOrder.sortBy}
            onSortChange={(sortBy) => {
              onSortChange(sortBy)
              setSelectedIndex(-1)
            }}
            collapseOverrides={collapseOverrides}
            onToggleGroup={(group, collapsed) =>
              setCollapseOverrides((current) => new Map(current).set(group.key, collapsed))
            }
            selectedKey={selectedKey}
            now={now}
            lineage={lineage}
            expandedKeys={expandedKeys}
            onOpen={(row) => openItem(rowItem(row), onOpen)}
            onPopout={(row) => openItem(rowItem(row), onPopout)}
            onJump={(row) => openItem(rowItem(row), onJump)}
          />
        ) : null}
      </div>
      <AgentHubPanelFooter />
    </div>
  )
}
