import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { isEditableTarget } from '@/lib/editable-target'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { formatAgentToolPreview } from '@/lib/agent-row-tool-preview'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { NativeChatInteractiveCardControl } from '../native-chat/NativeChatInteractiveCard'
import { AgentHubAttentionCard } from './AgentHubAttentionCard'
import { AgentHubPanelFooter } from './AgentHubPanelFooter'
import { AgentHubRow } from './AgentHubRow'
import { AgentHubTerminalTree } from './AgentHubTerminalTree'
import {
  moveAgentHubSelection,
  nextAgentHubTab,
  resolveAgentHubKeyAction,
  type AgentHubTab
} from './agent-hub-keys'
import { agentHubStateSince, agentHubTurnSince, type AgentHubLists } from './agent-hub-lists'
import {
  paneTargetFromTerminalRow,
  paneTargetFromThread,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import {
  filterAgentHubTerminalTree,
  visibleAgentHubTreeRows,
  type AgentHubGroupNode
} from './agent-hub-terminal-tree'

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

function SectionHeading({
  children,
  action
}: {
  children: React.ReactNode
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-7 items-center gap-2 px-2 pt-2">
      <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
        {children}
      </span>
      {action ? <span className="ml-auto flex items-center gap-0.5">{action}</span> : null}
    </div>
  )
}

export function AgentHubPanel({
  lists,
  tree,
  terminalCount,
  locationOf,
  rootRef,
  onJump,
  onPopout,
  onMarkRead
}: {
  lists: AgentHubLists
  tree: readonly AgentHubGroupNode[]
  terminalCount: number
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => string
  rootRef: React.RefObject<HTMLDivElement | null>
  onJump: (request: AgentHubOpenRequest) => void
  onPopout: (request: AgentHubOpenRequest) => void
  onMarkRead: (paneKeys: string[]) => void
}): React.JSX.Element {
  const [tab, setTab] = useState<AgentHubTab>('inbox')
  const [cardIndex, setCardIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [query, setQuery] = useState('')
  const [collapseOverrides, setCollapseOverrides] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const cardControlRef = useRef<NativeChatInteractiveCardControl>(null)
  const now = useNow(30_000)

  const needsYou = lists.needsYou
  const activeCardIndex = Math.min(cardIndex, Math.max(0, needsYou.length - 1))
  const cardThread = needsYou[activeCardIndex] ?? null
  const filteredTree = useMemo(() => filterAgentHubTerminalTree(tree, query), [tree, query])
  const items = useMemo<HubItem[]>(() => {
    if (tab === 'inbox') {
      return lists.finished.map(threadItem)
    }
    if (tab === 'running') {
      return lists.working.map(threadItem)
    }
    return visibleAgentHubTreeRows(filteredTree, collapseOverrides, query).map((row) => ({
      key: row.key,
      thread: row.thread,
      target: paneTargetFromTerminalRow(row)
    }))
  }, [tab, lists, filteredTree, collapseOverrides, query])
  const activeIndex = Math.min(selectedIndex, items.length - 1)
  const selectedKey = items[activeIndex]?.key ?? null

  useEffect(() => {
    rootRef.current
      ?.querySelector('[data-agent-hub-row][data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedKey, rootRef])

  const switchTab = (next: AgentHubTab): void => {
    setTab(next)
    setSelectedIndex(-1)
    if (next === 'all') {
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

  const inboxCount = needsYou.length + lists.finished.length

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex max-h-[min(640px,calc(100vh-96px))] min-h-0 flex-col outline-none"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold">{translate('agentHub.title', 'Agents')}</h2>
        <Tabs
          value={tab}
          onValueChange={(value) =>
            switchTab(value === 'running' || value === 'all' ? value : 'inbox')
          }
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="inbox" tabIndex={-1}>
              {translate('agentHub.tab.inbox', 'Inbox')}
              <span className="text-[11px] tabular-nums text-muted-foreground">{inboxCount}</span>
            </TabsTrigger>
            <TabsTrigger value="running" tabIndex={-1}>
              {translate('agentHub.tab.running', 'Running')}
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {lists.working.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="all" tabIndex={-1}>
              {translate('agentHub.tab.all', 'All terminals')}
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {terminalCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div role="listbox" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-sleek">
        {tab === 'inbox' ? (
          <>
            {cardThread ? (
              <>
                <SectionHeading
                  action={
                    needsYou.length > 1 ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          tabIndex={-1}
                          aria-label={translate('agentHub.inbox.previous', 'Previous')}
                          onClick={() => pageCard(-1)}
                        >
                          <ChevronLeft className="size-3.5" />
                        </Button>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {activeCardIndex + 1}/{needsYou.length}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          tabIndex={-1}
                          aria-label={translate('agentHub.inbox.next', 'Next')}
                          onClick={() => pageCard(1)}
                        >
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </>
                    ) : null
                  }
                >
                  {translate('agentHub.inbox.needsYou', 'Needs you')}
                  <span className="tabular-nums">{needsYou.length}</span>
                </SectionHeading>
                <div className="px-2">
                  <AgentHubAttentionCard
                    key={cardThread.paneKey}
                    thread={cardThread}
                    location={locationOf(cardThread)}
                    now={now}
                    controlRef={cardControlRef}
                    onJump={() => openItem(threadItem(cardThread), false)}
                    onPopout={() => openItem(threadItem(cardThread), true)}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 px-4 py-6 text-center text-xs text-muted-foreground">
                <AgentStateDot state="done" size="md" title={null} />
                <span className="text-sm text-foreground">
                  {translate('agentHub.inbox.emptyTitle', 'Nobody is waiting on you')}
                </span>
                {lists.working.length > 0 ? (
                  <span>
                    {lists.working.length === 1
                      ? translate('agentHub.inbox.emptyWorkingOne', '1 agent working')
                      : translate('agentHub.inbox.emptyWorking', '{{value0}} agents working', {
                          value0: lists.working.length
                        })}
                  </span>
                ) : null}
              </div>
            )}
            {lists.finished.length > 0 ? (
              <>
                <SectionHeading
                  action={
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      tabIndex={-1}
                      onClick={() => onMarkRead(lists.finished.map((thread) => thread.paneKey))}
                    >
                      {translate('agentHub.inbox.markAllRead', 'Mark all read')}
                    </Button>
                  }
                >
                  {translate('agentHub.inbox.finished', 'Finished')}
                  <span className="tabular-nums">{lists.finished.length}</span>
                </SectionHeading>
                {lists.finished.map((thread) => {
                  const item = threadItem(thread)
                  return (
                    <AgentHubRow
                      key={item.key}
                      thread={thread}
                      agentType={thread.agentType}
                      title={item.target.title}
                      subtitle={activityThreadRowCopy(thread).statusLine || locationOf(thread)}
                      trailing={formatShortTimeAgo(agentHubStateSince(thread), now)}
                      selected={item.key === selectedKey}
                      onPopout={() => openItem(item, true)}
                      onJump={() => openItem(item, false)}
                      onMarkRead={() => onMarkRead([thread.paneKey])}
                    />
                  )
                })}
              </>
            ) : null}
          </>
        ) : null}
        {tab === 'running' ? (
          lists.working.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {translate('agentHub.running.empty', 'No agent is working right now')}
            </p>
          ) : (
            lists.working.map((thread) => {
              const item = threadItem(thread)
              const tool = thread.currentAgentEntry
                ? formatAgentToolPreview(thread.currentAgentEntry, 'working')
                : ''
              return (
                <AgentHubRow
                  key={item.key}
                  thread={thread}
                  agentType={thread.agentType}
                  title={item.target.title}
                  subtitle={tool || locationOf(thread)}
                  trailing={formatShortTimeAgo(agentHubTurnSince(thread), now)}
                  selected={item.key === selectedKey}
                  onPopout={() => openItem(item, true)}
                  onJump={() => openItem(item, false)}
                />
              )
            })
          )
        ) : null}
        {tab === 'all' ? (
          <AgentHubTerminalTree
            groups={filteredTree}
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
