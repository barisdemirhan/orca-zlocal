import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { BotChatStatusSlot } from '../bots/BotChatOriginIcon'
import { BotChatTreeWorkerRow } from '../bots/BotChatTreeWorkerRow'
import { openChat } from '../bots/BotChatTreeGroup'
import { openBotAutomation } from '../bots/bot-automation-open'
import { useBotOwnChatTree } from '../bots/use-bot-chat-tree'
import { useBotActivity } from '../bots/use-bot-activity'
import { Clock, PictureInPicture2 } from 'lucide-react'
import { HubRowAction } from './AgentHubRowActions'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { chatsTabWorkers } from '../../../../shared/bots/bot-chat-tree-view'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'

const CHATS_SHOWN = 6
const WORKERS_SHOWN = 3
const AUTOMATIONS_SHOWN = 4

function homeFirst(chats: readonly BotChatTreeChat[]): BotChatTreeChat[] {
  const open = chats.filter((chat) => !chat.closed)
  return [
    ...open.filter((chat) => chat.origin === 'home'),
    ...open.filter((chat) => chat.origin !== 'home')
  ]
}

function TreeLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  )
}

/** A bot's chats (Home first, workers indented under theirs) and automations, folded under its row. */
export function AgentHubBotsTree({
  bot,
  onNavigate,
  onMore
}: {
  bot: Bot
  onNavigate: () => void
  onMore: () => void
}): React.JSX.Element {
  const { chats } = useBotOwnChatTree(bot)
  const activity = useBotActivity(bot)
  const ordered = useMemo(() => homeFirst(chats), [chats])
  const shown = ordered.slice(0, CHATS_SHOWN)
  const automations = activity.automations.slice(0, AUTOMATIONS_SHOWN)
  return (
    <div data-agent-hub-bots-tree={bot.id} className="ml-6 flex flex-col pb-1.5">
      {shown.length > 0 ? (
        <TreeLabel>{translate('agentHub.bots.tab.chats', 'Chats')}</TreeLabel>
      ) : null}
      {shown.map((chat) => {
        const { workers } = chatsTabWorkers(chat, WORKERS_SHOWN)
        return (
          <div key={chat.chatId}>
            <div className="group/chat flex min-w-0 items-center rounded-md hover:bg-foreground/[0.05]">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  openChat(bot, chat)
                  onNavigate()
                }}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left text-xs text-foreground"
              >
                <BotChatStatusSlot chat={chat} />
                <span className="min-w-0 flex-1 truncate">{chat.title}</span>
              </button>
              {chat.run ? null : (
                <span className="hidden pr-1 group-hover/chat:flex">
                  <HubRowAction
                    label={translate('agentHub.bots.mirror', 'Open in mirror')}
                    onClick={() =>
                      void mirrorBotChat(
                        bot,
                        chat.origin === 'home' ? null : (chat.liveSessionId ?? chat.chatId)
                      )
                    }
                  >
                    <PictureInPicture2 className="size-3.5" />
                  </HubRowAction>
                </span>
              )}
            </div>
            {workers.length > 0 ? (
              <div className="ml-4">
                {workers.map((worker) => (
                  <BotChatTreeWorkerRow
                    key={worker.key}
                    bot={bot}
                    worker={worker}
                    chat={chat.title}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
      {ordered.length > shown.length ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={onMore}
          className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          {translate('agentHub.bots.tab.moreChats', '{{count}} more chats', {
            count: ordered.length - shown.length
          })}
        </button>
      ) : null}
      {automations.length > 0 ? (
        <TreeLabel>{translate('agentHub.bots.tab.automations', 'Automations')}</TreeLabel>
      ) : null}
      {automations.map((row) => (
        <button
          key={row.key}
          type="button"
          tabIndex={-1}
          onClick={() => {
            openBotAutomation(row.automation.id, row.latestRunId ?? null)
            onNavigate()
          }}
          className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-foreground hover:bg-foreground/[0.05]"
        >
          <Clock aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{row.automation.name}</span>
        </button>
      ))}
      {shown.length === 0 && automations.length === 0 ? (
        <div className="px-2 py-1 text-xs text-muted-foreground">
          {translate('agentHub.bots.tab.treeEmpty', 'Nothing here yet')}
        </div>
      ) : null}
    </div>
  )
}
