import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { isEditableTarget } from '@/lib/editable-target'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubNestedCount } from './AgentHubAtoms'
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
import { agentOnlyAgentHubTree, type AgentHubGroupNode } from './agent-hub-terminal-tree'
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
  terminalCount,
  locationOf,
  rootRef,
  onJump,
  onPopout,
  onMarkRead,
  onClose,
  initialTab = 'inbox',
  onTabChange,
  initialPaneKey = null
}: {
  lists: AgentHubLists
  lineage: AgentHubLineage
  tree: readonly AgentHubGroupNode[]
  terminalCount: number
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  rootRef: React.RefObject<HTMLDivElement | null>
  onJump: (request: AgentHubOpenRequest) => void
  onPopout: (request: AgentHubOpenRequest) => void
  onMarkRead: (paneKeys: string[]) => void
  onClose: () => void
  initialTab?: AgentHubTab
  /** Reports the tab on show, so the dock can close the hub when it is clicked again. */
  onTabChange?: (tab: AgentHubTab) => void
  /** Opens the Inbox on this waiting agent's card (an alert was clicked). */
  initialPaneKey?: string | null
}): React.JSX.Element {
  const [tab, setTab] = useState<AgentHubTab>(initialTab)
  const [cardIndex, setCardIndex] = useState(() =>
    Math.max(
      0,
      lists.needsYou.findIndex((thread) => thread.paneKey === initialPaneKey)
    )
  )
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
  const activeCardIndex = Math.min(cardIndex, Math.max(0, needsYou.length - 1))
  const cardThread = needsYou[activeCardIndex] ?? null
  const agentTree = useMemo(() => agentOnlyAgentHubTree(tree), [tree])
  const agentCount = agentTree.reduce((total, group) => total + group.rowCount, 0)
  const listsTerminals = tab === 'agents' || tab === 'all'
  const filteredTree = useMemo(
    () => filterAgentHubTerminalTree(tab === 'agents' ? agentTree : tree, query),
    [tab, agentTree, tree, query]
  )
  const items = useMemo<HubItem[]>(() => {
    if (tab === 'inbox') {
      return lists.finished.map(threadItem)
    }
    if (tab === 'running') {
      return visibleAgentHubRunningThreads(lists.working, lineage, expandedKeys).map(threadItem)
    }
    return visibleAgentHubTreeRows(filteredTree, collapseOverrides, query, expandedKeys).map(
      (row) => ({
        key: row.key,
        thread: row.thread,
        target: paneTargetFromTerminalRow(row)
      })
    )
  }, [tab, lists, lineage, expandedKeys, filteredTree, collapseOverrides, query])
  const activeIndex = Math.min(selectedIndex, items.length - 1)
  const selectedKey = items[activeIndex]?.key ?? null

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
      setCardIndex((activeCardIndex + delta + needsYou.length) % needsYou.length)
    }
  }

  const openItem = (item: HubItem | null, popout: boolean): void => {
    if (item) {
      ;(popout ? onPopout : onJump)({ target: item.target, thread: item.thread })
    }
  }

  const threadActions: AgentHubThreadActions = {
    locationOf,
    isSelected: (thread) => thread.paneKey === selectedKey,
    onJump: (thread) => openItem(threadItem(thread), false),
    onPopout: (thread) => openItem(threadItem(thread), true)
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
          action.popout
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
      <div className="flex shrink-0 items-center gap-2.5 pt-3.5 pr-3 pb-2.5 pl-[18px]">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
          {translate('agentHub.title', 'Agents')}
        </h2>
        <div
          role="tablist"
          className="ml-auto flex gap-0.5 rounded-[10px] border border-border bg-background p-0.5"
        >
          {AGENT_HUB_TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              tabIndex={-1}
              aria-selected={tab === value}
              data-active={tab === value}
              onClick={() => switchTab(value)}
              className="group/tab flex items-center gap-1.5 rounded-lg px-[9px] py-1 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground"
            >
              {tabLabel(value)}
              <span
                data-ask={value === 'inbox' && needsYou.length > 0}
                className="font-mono text-[10.5px] text-muted-foreground/70 group-data-[active=true]/tab:text-muted-foreground data-[ask=true]:text-agent-question group-data-[active=true]/tab:data-[ask=true]:text-agent-question"
              >
                {counts[value]}
                {value === 'running' ? <HubNestedCount value={lists.nestedWorking} /> : null}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          tabIndex={-1}
          aria-label={translate('agentHub.close', 'Close (esc)')}
          onClick={onClose}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <X className="size-[15px]" />
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
            collapseOverrides={collapseOverrides}
            onToggleGroup={(group, collapsed) =>
              setCollapseOverrides((current) => new Map(current).set(group.key, collapsed))
            }
            selectedKey={selectedKey}
            now={now}
            lineage={lineage}
            expandedKeys={expandedKeys}
            onPopout={(row) =>
              openItem(
                { key: row.key, thread: row.thread, target: paneTargetFromTerminalRow(row) },
                true
              )
            }
            onJump={(row) =>
              openItem(
                { key: row.key, thread: row.thread, target: paneTargetFromTerminalRow(row) },
                false
              )
            }
          />
        ) : null}
      </div>
      <AgentHubPanelFooter />
    </div>
  )
}
