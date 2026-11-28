import { useState } from 'react'
import { ChevronRight, History, PictureInPicture2 } from 'lucide-react'
import StatusIndicator from '@/components/sidebar/workspace-card/surface/StatusIndicator'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { cn } from '@/lib/class-names'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { openChat } from '../bots/BotChatTreeGroup'
import { BotChatStatusSlot } from '../bots/BotChatOriginIcon'
import { BotChatTreeWorkerRow } from '../bots/BotChatTreeWorkerRow'
import { AgentHubBotsChatLine } from './AgentHubBotsChatLine'
import { AgentHubRenameDialog } from './AgentHubRenameDialog'
import { HubRowAction } from './AgentHubRowActions'
import { BotsContextMenu, BotsMoreMenu, type BotsMenuEntry } from './AgentHubBotsMenus'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { markBotChatRead } from './agent-hub-bots-actions'
import { BOTS_WORKERS_SHOWN, botsMoreKey } from './agent-hub-bots-chats'
import {
  updateAgentHubPanelListState,
  useAgentHubPanelListState
} from './agent-hub-panel-list-state'
import { chatsTabWorkers } from '../../../../shared/bots/bot-chat-tree-view'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'
import type { Bot } from '../../../../shared/bot-types'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'

function ChatStateDot({ chat }: { chat: BotChatTreeChat }): React.JSX.Element | null {
  if (chat.live === 'needs-you') {
    return (
      <span className="size-2 shrink-0 rounded-full bg-agent-question motion-safe:animate-pulse" />
    )
  }
  if (chat.live === 'replying') {
    return <StatusIndicator status="working" showTooltip={false} />
  }
  return chat.failedTotal > 0 ? (
    <span className="size-2 shrink-0 rounded-full bg-destructive" />
  ) : null
}

function useChatMenuEntries({
  bot,
  chat,
  blocked,
  onRename,
  onNavigate
}: {
  bot: Bot
  chat: BotChatTreeChat
  blocked: string | null
  /** Null while the chat has no open tab to carry a name. */
  onRename: (() => void) | null
  onNavigate: () => void
}): BotsMenuEntry[] {
  const mirrorId = chat.origin === 'home' ? null : (chat.liveSessionId ?? chat.chatId)
  return [
    ...(chat.run
      ? []
      : [
          {
            key: 'mirror',
            label: translate('agentHub.bots.mirror', 'Open in mirror'),
            shortcut: '⌥↵',
            blocked,
            onSelect: () => void mirrorBotChat(bot, mirrorId)
          }
        ]),
    {
      key: 'main',
      label: translate('agentHub.bots.tab.openMain', 'Open in main tab'),
      blocked,
      onSelect: () => {
        openChat(bot, chat)
        onNavigate()
      }
    },
    {
      key: 'read',
      label: translate('agentHub.bots.tab.markRead', 'Mark read'),
      blocked: chat.unread ? null : translate('agentHub.bots.tab.alreadyRead', 'Already read'),
      onSelect: () => markBotChatRead(chat)
    },
    ...(onRename
      ? [
          'separator' as const,
          {
            key: 'rename',
            label: translate('agentHub.rowMenu.rename', 'Rename…'),
            blocked,
            onSelect: onRename
          }
        ]
      : [])
  ]
}

/** One chat under a bot: origin icon, title, last line, its workers behind a count, state dot and age. */
export function AgentHubBotsChatRow({
  bot,
  botKey,
  chat,
  selectedKey,
  blocked,
  onNavigate
}: {
  bot: Bot
  botKey: string
  chat: BotChatTreeChat
  selectedKey: string | null
  /** Why the row's actions are off (its host is offline); null while they work. */
  blocked: string | null
  onNavigate: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { botsShowMore } = useAgentHubPanelListState()
  const navKey = `chat:${botKey}:${chat.chatId}`
  const moreKey = botsMoreKey(botKey, `workers:${chat.chatId}`)
  const allWorkers = botsShowMore.has(moreKey)
  const total = chat.runningTotal + chat.finishedTotal
  const { workers } = chatsTabWorkers(chat, allWorkers ? total : BOTS_WORKERS_SHOWN)
  const [renaming, setRenaming] = useState(false)
  const tabId = useAppStore(
    (s) =>
      findStructuredAgentSessionTab(s.unifiedTabsByWorktree, {
        workspaceId: folderWorkspaceKey(bot.folderWorkspaceId),
        sessionId: chat.liveSessionId ?? chat.chatId
      })?.id ?? null
  )
  const entries = useChatMenuEntries({
    bot,
    chat,
    blocked,
    onRename: tabId && chat.origin !== 'home' && !chat.run ? () => setRenaming(true) : null,
    onNavigate
  })
  const mirrorId = chat.origin === 'home' ? null : (chat.liveSessionId ?? chat.chatId)
  return (
    <div>
      <BotsContextMenu entries={entries}>
        <div
          data-hub-nav=""
          data-nav-key={navKey}
          data-nav-parent={`bot:${botKey}`}
          data-nav-foldable={total > 0 ? '' : undefined}
          data-selected={selectedKey === navKey}
          className="group/c flex min-w-0 items-start rounded-md pr-1.5 pl-1 hover:bg-accent data-[selected=true]:bg-accent"
        >
          <button
            type="button"
            tabIndex={-1}
            data-nav-open=""
            aria-disabled={blocked !== null}
            title={blocked ?? undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!blocked) {
                openChat(bot, chat)
                onNavigate()
              }
            }}
            className="flex min-w-0 flex-1 items-start gap-1.5 py-1.5 pl-1 text-left"
          >
            <span className="mt-0.5 grid h-5 w-4 shrink-0 place-items-center text-muted-foreground/70">
              {chat.closed ? (
                <History aria-hidden className="size-3" />
              ) : (
                <BotChatStatusSlot chat={{ origin: chat.origin, live: 'idle' }} />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'min-w-0 truncate text-[13px] leading-5',
                    chat.unread && 'font-semibold'
                  )}
                >
                  {chat.title}
                </span>
                {chat.unread ? (
                  <span
                    title={translate('agentHub.bots.tab.unread', 'Unread')}
                    className="size-1.5 shrink-0 rounded-full bg-status-success"
                  />
                ) : null}
              </span>
              <AgentHubBotsChatLine bot={bot} chat={chat} />
            </span>
          </button>
          {total > 0 ? (
            <button
              type="button"
              tabIndex={-1}
              data-nav-toggle=""
              aria-expanded={open}
              aria-label={translate(
                'agentHub.bots.tab.toggleWorkers',
                'Show workers of {{title}}',
                {
                  title: chat.title
                }
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen(!open)}
              className="mt-1.5 flex h-5 shrink-0 items-center rounded-md px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {total}
              <ChevronRight
                aria-hidden
                className={cn('size-3 transition-transform', open && 'rotate-90')}
              />
            </button>
          ) : null}
          <span className="mt-1.5 ml-1 grid h-5 w-4 shrink-0 place-items-center">
            <ChatStateDot chat={chat} />
          </span>
          <span className="mt-1.5 ml-1 flex h-5 min-w-7 shrink-0 items-center justify-end">
            <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums group-hover/c:hidden group-has-[[data-state=open]]/c:hidden">
              {formatShortTimeAgo(chat.lastActiveAt)}
            </span>
            <span className="hidden items-center group-hover/c:flex group-has-[[data-state=open]]/c:flex">
              {chat.run ? null : (
                <span data-nav-mirror="">
                  <HubRowAction
                    label={translate('agentHub.bots.mirror', 'Open in mirror')}
                    onClick={() => {
                      if (!blocked) {
                        void mirrorBotChat(bot, mirrorId)
                      }
                    }}
                  >
                    <PictureInPicture2 className="size-3.5" />
                  </HubRowAction>
                </span>
              )}
              <BotsMoreMenu entries={entries} />
            </span>
          </span>
        </div>
      </BotsContextMenu>
      {renaming && tabId ? (
        <AgentHubRenameDialog
          tabId={tabId}
          title={chat.title}
          heading={translate('agentHub.bots.tab.renameChat', 'Rename chat')}
          onOpenChange={setRenaming}
        />
      ) : null}
      {open
        ? workers.map((worker) => (
            <div
              key={worker.key}
              data-hub-nav=""
              data-nav-key={`worker:${botKey}:${chat.chatId}:${worker.key}`}
              data-nav-parent={navKey}
              data-selected={selectedKey === `worker:${botKey}:${chat.chatId}:${worker.key}`}
              className="ml-5 rounded-md data-[selected=true]:bg-accent"
            >
              <BotChatTreeWorkerRow bot={bot} worker={worker} chat={chat.title} />
            </div>
          ))
        : null}
      {open && total > workers.length ? (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            updateAgentHubPanelListState({ botsShowMore: new Set(botsShowMore).add(moreKey) })
          }
          className="ml-8 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          {translate('agentHub.bots.tab.showMore', 'Show {{count}} more', {
            count: total - workers.length
          })}
        </button>
      ) : null}
    </div>
  )
}
