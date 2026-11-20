import { useAgentHubSortedTree } from './use-agent-hub-sorted-tree'
import { registerAgentHubSelectedTarget } from './agent-hub-active-target'
import { AgentHubShortcutsButton } from './AgentHubShortcutsDialog'
import { AgentHubSettingsButton } from './AgentHubSettingsButton'
import {
  agentHubInboxRequests,
  agentHubAwayAnswerCount,
  useAgentHubRequests
} from './agent-hub-requests-store'
import { agentHubTabLabel } from './agent-hub-copy'
import { agentHubInboxCards } from './agent-hub-inbox-cards'
import {
  agentHubRequestPresentation,
  type AgentHubRequestPresentation
} from './agent-hub-request-presentation'
import { useAppStore } from '@/store'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useNow } from '@/lib/window-activity/use-now'
import { isEditableTarget } from '@/lib/text-input/focus/editable-target'
import { translate } from '@/i18n/i18n'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
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
import {
  agentHubThreadCardKey,
  showAgentHubCardsAgain,
  useAgentHubCardRecordVersion,
  withoutDismissedAgentHubCards
} from './agent-hub-answered-cards'
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
import type { AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'
import { isAgentHubTreeNarrowed, visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'
import type { AgentHubWindowFilter } from './agent-hub-window-filter'
import { useAgentHubHostFilter } from './use-agent-hub-host-filter'

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
  initialPaneKey = null,
  requestPresentationOf
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
  requestPresentationOf?: (
    host: string,
    request: AgentHubRequestBase
  ) => AgentHubRequestPresentation
}): React.JSX.Element {
  const [tab, setTab] = useState<AgentHubTab>(initialTab)
  const presentationOf =
    requestPresentationOf ??
    ((host: string, request: AgentHubRequestBase) =>
      agentHubRequestPresentation(useAppStore.getState(), [], host, request, locationOf))
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
  const [windowFilter, setWindowFilter] = useState<AgentHubWindowFilter>('any')
  const hostFilter = useAgentHubHostFilter(tree, () => setSelectedIndex(-1))
  const [collapseOverrides, setCollapseOverrides] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const cardControlRef = useRef<AgentHubCardControl>(null)
  const expandedKeys = useAgentHubExpandedChildren()
  const now = useNow(30_000)
  const popoutKeys = agentHubPopoutKeys()

  // Why: a card closed without an answer leaves the Inbox; its agent keeps waiting and counting.
  useAgentHubCardRecordVersion()
  const needsYou = withoutDismissedAgentHubCards(lists.needsYou, 'inbox')
  const requests = useAgentHubRequests()
  const requestCards = agentHubInboxRequests(requests)
  const cards = agentHubInboxCards(needsYou, requestCards)
  const awayCount = agentHubAwayAnswerCount(requests)
  const hiddenCards = lists.needsYou.length - needsYou.length
  const focusedCardIndex =
    cardFocus.paneKey === null ? -1 : cards.findIndex((card) => card.key === cardFocus.paneKey)
  const activeCardIndex =
    focusedCardIndex >= 0
      ? focusedCardIndex
      : Math.min(cardFocus.index, Math.max(0, cards.length - 1))
  const card = cards[activeCardIndex] ?? null
  const cardThread = card?.thread ?? null
  if (card && card.key !== cardFocus.paneKey) {
    setCardFocus({ paneKey: card.key, index: activeCardIndex })
  }
  const agentTree = useMemo(() => agentOnlyAgentHubTree(tree), [tree])
  const agentCount = agentTree.reduce((total, group) => total + group.rowCount, 0)
  const listsTerminals = tab === 'agents' || tab === 'all'
  const sortedTree = useAgentHubSortedTree(
    tab === 'agents' ? agentTree : tree,
    query,
    treeOrder,
    windowFilter,
    hostFilter.rowTest
  )
  const filteredTree = useHeldAgentHubTree(
    sortedTree,
    `${tab}\u0000${treeOrder.sortBy}\u0000${query}\u0000${windowFilter}\u0000${hostFilter.value}`
  )
  const narrowed = isAgentHubTreeNarrowed(query, windowFilter, hostFilter.value)
  const items = useMemo<HubItem[]>(() => {
    if (tab === 'inbox') {
      return lists.finished.map(threadItem)
    }
    if (tab === 'running') {
      return visibleAgentHubRunningThreads(lists.working, lineage, expandedKeys).map(threadItem)
    }
    return visibleAgentHubTreeRows(filteredTree, collapseOverrides, narrowed, expandedKeys).map(
      rowItem
    )
  }, [tab, lists, lineage, expandedKeys, filteredTree, collapseOverrides, narrowed])
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
    if (cards.length > 0) {
      const index = (activeCardIndex + delta + cards.length) % cards.length
      setCardFocus({ paneKey: cards[index]?.key ?? null, index })
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
      hasCard: card !== null
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
      case 'open': {
        const row = items[activeIndex]
        if (row) {
          openItem(row, action.popout ? onPopout : onJump)
        } else if (tab === 'inbox' && cardThread) {
          // The card's own Pop out: its mirror takes over and the hub closes.
          openItem(threadItem(cardThread), action.popout ? onOpen : onJump)
        }
        break
      }
      case 'answer':
        if (!cardControlRef.current?.chooseOption(action.optionIndex)) {
          return
        }
        break
    }
    event.preventDefault()
  }

  const counts: Record<AgentHubTab, number> = {
    inbox: lists.needsYou.length + requestCards.length + lists.finished.length + awayCount,
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
          tabs={AGENT_HUB_TABS.map((value) => ({ value, label: agentHubTabLabel(value) }))}
          value={tab}
          onChange={switchTab}
          askValue={lists.needsYou.length + requestCards.length > 0 ? 'inbox' : undefined}
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
        <AgentHubSettingsButton onOpened={onClose} />
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
            lists={{ ...lists, needsYou }}
            hiddenCards={hiddenCards}
            onShowHidden={() =>
              showAgentHubCardsAgain(lists.needsYou.map(agentHubThreadCardKey), 'inbox')
            }
            cardIndex={activeCardIndex}
            cards={cards}
            requestPresentationOf={presentationOf}
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
            windowFilter={{
              value: windowFilter,
              onChange: (next) => {
                setWindowFilter(next)
                setSelectedIndex(-1)
              },
              host: hostFilter
            }}
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
