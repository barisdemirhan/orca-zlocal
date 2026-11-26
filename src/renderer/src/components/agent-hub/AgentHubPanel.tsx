import { useNearestAgentHubSelection } from './agent-hub-nearest-row'
import { registerAgentHubSelectedTarget } from './agent-hub-active-target'
import { AgentHubPanelTerminalList } from './AgentHubPanelTerminalList'
import { useAgentHubPanelTerminalList } from './use-agent-hub-panel-terminal-list'
import { AgentHubInboxList } from './AgentHubInboxList'
import type { AgentHubInboxItem, AgentHubInboxModel } from './agent-hub-inbox-model'
import {
  resetAgentHubPanelListState,
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import { useAgentHubInboxView } from './use-agent-hub-inbox-view'
import { useAgentHubSurfaceSetting } from './use-agent-hub-surface-setting'
import { finishedAgentHubPaneKeys, laterAgentHubInboxEntry } from './agent-hub-inbox-later'
import { AgentHubInboxSubHeader } from './AgentHubInboxSubHeader'
import { openBotSettingsPage } from '../bots/bot-settings-open'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import {
  agentHubRequestPresentation,
  type AgentHubRequestPresentation
} from './agent-hub-request-presentation'
import { useAppStore } from '@/store'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  rowItem,
  threadItem,
  threadTarget,
  useAgentHubPanelItems,
  useScrollSelectedAgentHubRow,
  type HubItem
} from './use-agent-hub-panel-items'
import { useNow } from '@/lib/window-activity/use-now'
import { isEditableTarget } from '@/lib/text-input/focus/editable-target'
import type { AgentHubTerminalSort } from '../../../../shared/agent-hub-settings'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { AgentHubPanelHeader } from './AgentHubPanelHeader'
import { AgentHubBotsTab } from './AgentHubBotsTab'
import { useAgentHubBotsTab } from './use-agent-hub-bots-tab'
import { AgentHubPanelFooter, agentHubPopoutKeys } from './AgentHubPanelFooter'
import type { AgentHubThreadActions } from './AgentHubPanelSections'
import { AgentHubRunningBody } from './AgentHubRunningBody'
import {
  moveAgentHubSelection,
  nextAgentHubTab,
  resolveAgentHubKeyAction,
  type AgentHubTab
} from './agent-hub-keys'
import { useAgentHubExpandedChildren } from './agent-hub-child-expansion'
import type { AgentHubLineage } from './agent-hub-lineage'
import type { AgentHubLists } from './agent-hub-lists'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'
import type { AgentHubTreeOrder } from './agent-hub-terminal-tree-sort'
import { useAgentHubHostFilter } from './use-agent-hub-host-filter'

export type AgentHubOpenRequest = {
  target: AgentHubPaneTarget
  thread: AgentPaneThread | null
}

export function AgentHubPanel({
  lists,
  inbox,
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
  /** The one computation behind the dock's counts and this panel's Inbox. */
  inbox: AgentHubInboxModel
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
  /** Opens the Inbox on this waiting agent's row (an alert was clicked). */
  initialPaneKey?: string | null
  requestPresentationOf?: (
    host: string,
    request: AgentHubRequestBase
  ) => AgentHubRequestPresentation
}): React.JSX.Element {
  const [pickedTab, setTab] = useState<AgentHubTab>(initialTab)
  const { tab, tabs, options: tabOptions, botCount } = useAgentHubBotsTab(pickedTab)
  const presentationOf =
    requestPresentationOf ??
    ((host: string, request: AgentHubRequestBase) =>
      agentHubRequestPresentation(useAppStore.getState(), [], host, request, locationOf))
  // Selection follows the row's identity, so a re-sorted list keeps the same row selected.
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null)
  const clearSelection = (): void => setSelectedRowKey(null)
  const rememberListState = useAgentHubSurfaceSetting('agentHubRememberListState')
  const listState = useAgentHubPanelListState()
  const { collapseOverrides } = listState
  useEffect(
    () => () => {
      if (!rememberListState) {
        resetAgentHubPanelListState()
      }
    },
    [rememberListState]
  )
  const hostFilter = useAgentHubHostFilter(tree, () => clearSelection())
  const searchRef = useRef<HTMLInputElement>(null)
  const expandedKeys = useAgentHubExpandedChildren()
  const now = useNow(30_000)
  const popoutKeys = agentHubPopoutKeys()

  const terminalList = useAgentHubPanelTerminalList(tab, tree, treeOrder, hostFilter)
  const { filteredTree, narrowed, foldAgentsList } = terminalList
  const listsTerminals = tab === 'agents' || tab === 'all'
  const items = useAgentHubPanelItems({
    tab,
    lists,
    lineage,
    expandedKeys,
    filteredTree,
    collapseOverrides,
    narrowed,
    foldAgentsList
  })
  const itemKeys = useMemo(() => items.map((item) => item.key), [items])
  useNearestAgentHubSelection(itemKeys, selectedRowKey, setSelectedRowKey)
  const activeIndex = items.findIndex((item) => item.key === selectedRowKey)
  const selectedKey = items[activeIndex]?.key ?? null
  const inboxView = useAgentHubInboxView(inbox, rootRef, {
    initialEntryId: initialPaneKey,
    onLater: laterAgentHubInboxEntry,
    onMarkRead: (entries) =>
      onMarkRead(
        entries.flatMap(({ payload }) =>
          payload.type === 'finished' ? [payload.thread.paneKey] : []
        )
      ),
    onOpenEntry: (entry, popout) => openInboxEntry(entry, popout),
    onSearch: () => switchTab('agents')
  })
  const popoutTarget =
    items[activeIndex]?.target ?? (tab === 'inbox' ? threadTarget(inboxView.selectedThread) : null)
  useEffect(() => registerAgentHubSelectedTarget(popoutTarget), [popoutTarget])

  useScrollSelectedAgentHubRow(rootRef, selectedKey)

  const switchTab = (next: AgentHubTab): void => {
    setTab(next)
    onTabChange?.(next)
    clearSelection()
    if (next === 'agents' || next === 'all') {
      requestAnimationFrame(() => searchRef.current?.focus())
    } else if (searchRef.current === document.activeElement) {
      rootRef.current?.focus()
    }
  }

  const openBots = (botKey: string | null): void => {
    updateAgentHubPanelListState({
      botsQuery: '',
      ...(botKey ? { botsExpanded: new Set([botKey]) } : {})
    })
    switchTab('bots')
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

  const openInboxEntry = (entry: AgentHubInboxItem, popout: boolean): void => {
    const { payload } = entry
    if (payload.type === 'thread' || payload.type === 'finished') {
      openItem(threadItem(payload.thread), popout ? onPopout : onJump)
    } else if (payload.type === 'bot-item') {
      void mirrorBotChat(payload.bot, payload.item.chat.id)
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
      hasCard: false
    })
    if (tab === 'inbox' && !isEditableTarget(event.target) && inboxView.onPanelKey(event)) {
      return
    }
    if (!action || (tab === 'inbox' && action.type !== 'switchTab')) {
      return
    }
    switch (action.type) {
      case 'switchTab':
        switchTab(nextAgentHubTab(tab, action.direction, tabs))
        break
      case 'moveSelection':
        setSelectedRowKey(
          items[moveAgentHubSelection(activeIndex, action.delta, items.length)]?.key ?? null
        )
        break
      case 'open': {
        const row = items[activeIndex]
        if (row) {
          openItem(row, action.popout ? onPopout : onJump)
        }
        break
      }
    }
    event.preventDefault()
  }

  const counts: Record<AgentHubTab, number> = {
    inbox: inbox.counts.inbox + lists.finished.length,
    running: lists.working.length,
    agents: terminalList.agentCount,
    all: terminalCount,
    bots: botCount
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex max-h-[50vh] min-h-[320px] flex-col outline-none"
    >
      <AgentHubPanelHeader
        tab={tab}
        tabOptions={tabOptions}
        counts={counts}
        nestedWorking={lists.nestedWorking}
        inbox={inbox}
        side={listState.side}
        onTab={switchTab}
        onClose={onClose}
      />
      {tab === 'inbox' ? (
        <AgentHubInboxSubHeader
          botsActive={inbox.botsActive}
          waiting={inbox.counts.inbox}
          finishedKeys={finishedAgentHubPaneKeys(inbox)}
          onMarkRead={onMarkRead}
        />
      ) : null}
      <div
        // Why keyed: each tab fades in fresh instead of swapping content in place.
        key={tab}
        role="listbox"
        data-tab={tab}
        className="min-h-0 flex-1 animate-in overflow-y-auto px-2.5 pb-2.5 duration-150 scrollbar-sleek fade-in-0 data-[tab=bots]:flex data-[tab=bots]:flex-col"
      >
        {tab === 'inbox' ? (
          <AgentHubInboxList
            model={inbox}
            view={inboxView}
            workingCount={lists.working.length}
            context={{
              now,
              popoutKeys,
              actions: threadActions,
              presentationOf,
              onMarkRead,
              onLater: laterAgentHubInboxEntry,
              onOpenEntry: openInboxEntry,
              onOpenBotPage: (bot) => {
                updateAgentHubPanelListState({ pendingBotPage: bot })
                switchTab('bots')
              },
              onOpenBotSettings: (bot) => {
                openBotSettingsPage(bot.id)
                onClose()
              }
            }}
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
        {tab === 'bots' ? <AgentHubBotsTab onClose={onClose} /> : null}
        {listsTerminals ? (
          <AgentHubPanelTerminalList
            list={terminalList}
            totalCount={tab === 'agents' ? terminalList.agentCount : terminalCount}
            searchRef={searchRef}
            hostFilter={hostFilter}
            botsAvailable={tabs.includes('bots')}
            onOpenBots={openBots}
            sortBy={treeOrder.sortBy}
            onSortChange={onSortChange}
            onListChanged={clearSelection}
            onMarkRead={onMarkRead}
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
