import { CalendarClock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import { openBotAutomation } from '../bots/bot-automation-open'
import { AgentHubBotsChatRow } from './AgentHubBotsChatRow'
import { BotsContextMenu } from './AgentHubBotsMenus'
import {
  BOTS_AUTOMATIONS_SHOWN,
  BOTS_CHATS_SHOWN,
  botsMoreKey,
  type BotsMoreList
} from './agent-hub-bots-chats'
import {
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import type { Bot } from '../../../../shared/bot-types'
import type { BotAutomationRow } from '../../../../shared/bots/bot-automation-rows'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'

function ShowMore({
  list,
  botKey,
  count
}: {
  list: BotsMoreList
  botKey: string
  count: number
}): React.JSX.Element {
  const { botsShowMore } = useAgentHubPanelListState()
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() =>
        updateAgentHubPanelListState({
          botsShowMore: new Set(botsShowMore).add(botsMoreKey(botKey, list))
        })
      }
      className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
    >
      {translate('agentHub.bots.tab.showMore', 'Show {{count}} more', { count })}
    </button>
  )
}

function AutomationRow({
  bot,
  botKey,
  row,
  selectedKey,
  blocked,
  onNavigate
}: {
  bot: Bot
  botKey: string
  row: BotAutomationRow
  selectedKey: string | null
  blocked: string | null
  onNavigate: () => void
}): React.JSX.Element {
  const navKey = `automation:${botKey}:${row.key}`
  const open = (): void => {
    if (!blocked) {
      openBotAutomation(bot.hostId, row.automation.id, row.latestRunId ?? null)
      onNavigate()
    }
  }
  return (
    <BotsContextMenu
      entries={[
        {
          key: 'open',
          label: translate('agentHub.bots.tab.openAutomation', 'Open automation'),
          shortcut: '↵',
          blocked,
          onSelect: open
        }
      ]}
    >
      <div
        data-hub-nav=""
        data-nav-key={navKey}
        data-nav-parent={`bot:${botKey}`}
        data-selected={selectedKey === navKey}
        className="flex min-w-0 rounded-md hover:bg-accent data-[selected=true]:bg-accent"
      >
        <button
          type="button"
          tabIndex={-1}
          data-nav-open=""
          aria-disabled={blocked !== null}
          title={blocked ?? undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 pl-2 text-left text-[13px]"
        >
          <span className="grid h-5 w-4 shrink-0 place-items-center text-muted-foreground/70">
            <CalendarClock aria-hidden className="size-3" />
          </span>
          <span className="min-w-0 flex-1 truncate">{row.automation.name}</span>
          {row.failing ? (
            <span className="shrink-0 text-2xs text-destructive">
              {translate('agentHub.bots.tab.automationFailing', 'Failing')}
            </span>
          ) : !row.automation.enabled ? (
            <span className="shrink-0 text-2xs text-muted-foreground">
              {translate('agentHub.bots.tab.automationPaused', 'Paused')}
            </span>
          ) : null}
        </button>
      </div>
    </BotsContextMenu>
  )
}

function AutomationsFold({
  botKey,
  automations,
  open,
  selectedKey
}: {
  botKey: string
  automations: readonly BotAutomationRow[]
  open: boolean
  selectedKey: string | null
}): React.JSX.Element {
  const { botsShowMore } = useAgentHubPanelListState()
  const navKey = `automations:${botKey}`
  const failing = automations.filter((row) => row.failing).length
  return (
    <div
      data-hub-nav=""
      data-nav-key={navKey}
      data-nav-parent={`bot:${botKey}`}
      data-nav-foldable=""
      data-selected={selectedKey === navKey}
      className="flex min-w-0 rounded-md hover:bg-accent data-[selected=true]:bg-accent"
    >
      <button
        type="button"
        tabIndex={-1}
        data-nav-toggle=""
        data-nav-open=""
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const next = new Set(botsShowMore)
          const key = botsMoreKey(botKey, 'automationsOpen')
          if (!next.delete(key)) {
            next.add(key)
          }
          updateAgentHubPanelListState({ botsShowMore: next })
        }}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 pl-2 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <span className="grid h-5 w-4 shrink-0 place-items-center">
          <ChevronRight
            aria-hidden
            className={cn('size-3 transition-transform', open && 'rotate-90')}
          />
        </span>
        <span>
          {translate('agentHub.bots.tab.automations', 'Automations')} · {automations.length}
        </span>
        {failing > 0 ? (
          <span className="text-destructive">
            {translate('agentHub.bots.tab.automationsFailing', '{{count}} failing', {
              count: failing
            })}
          </span>
        ) : null}
      </button>
    </div>
  )
}

/** A bot's chats (Needs you first, workers behind a count) and automations, folded under its row. */
export function AgentHubBotsTree({
  bot,
  botKey,
  chats,
  automations,
  selectedKey,
  blocked,
  onNavigate
}: {
  bot: Bot
  botKey: string
  chats: readonly BotChatTreeChat[]
  automations: readonly BotAutomationRow[]
  selectedKey: string | null
  blocked: string | null
  onNavigate: () => void
}): React.JSX.Element {
  const { botsShowMore } = useAgentHubPanelListState()
  const allChats = botsShowMore.has(botsMoreKey(botKey, 'chats'))
  const automationsOpen = botsShowMore.has(botsMoreKey(botKey, 'automationsOpen'))
  const allAutomations = botsShowMore.has(botsMoreKey(botKey, 'automations'))
  const shownChats = allChats ? chats : chats.slice(0, BOTS_CHATS_SHOWN)
  const shownAutomations = allAutomations
    ? automations
    : automations.slice(0, BOTS_AUTOMATIONS_SHOWN)
  return (
    <div
      data-agent-hub-bots-tree={bot.id}
      className="ml-8 flex flex-col border-l border-border pb-1.5 pl-1"
    >
      {shownChats.map((chat) => (
        <AgentHubBotsChatRow
          key={chat.chatId}
          bot={bot}
          botKey={botKey}
          chat={chat}
          selectedKey={selectedKey}
          blocked={blocked}
          onNavigate={onNavigate}
        />
      ))}
      {chats.length > shownChats.length ? (
        <ShowMore list="chats" botKey={botKey} count={chats.length - shownChats.length} />
      ) : null}
      {automations.length > 0 ? (
        <AutomationsFold
          botKey={botKey}
          automations={automations}
          open={automationsOpen}
          selectedKey={selectedKey}
        />
      ) : null}
      {automationsOpen
        ? shownAutomations.map((row) => (
            <AutomationRow
              key={row.key}
              bot={bot}
              botKey={botKey}
              row={row}
              selectedKey={selectedKey}
              blocked={blocked}
              onNavigate={onNavigate}
            />
          ))
        : null}
      {automationsOpen && automations.length > shownAutomations.length ? (
        <ShowMore
          list="automations"
          botKey={botKey}
          count={automations.length - shownAutomations.length}
        />
      ) : null}
      {chats.length === 0 && automations.length === 0 ? (
        <div className="px-2 py-1 text-xs text-muted-foreground">
          {translate('agentHub.bots.tab.treeEmpty', 'Nothing here yet')}
        </div>
      ) : null}
    </div>
  )
}
