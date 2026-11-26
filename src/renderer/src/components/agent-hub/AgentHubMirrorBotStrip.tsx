import { Maximize2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'
import { botChatNeedsOwner } from './agent-hub-bots-chats'
import { useBotChatTree } from '../bots/use-bot-chat-tree'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { AgentHubMirrorBotFace } from './AgentHubMirrorBotFace'
import { HubStateIndicator } from './AgentHubStateMarks'
import { newBotChatInMirror, showBotChatInMirror } from './agent-hub-bot-mirror'
import { openBotPage } from './agent-hub-bot-page-open'
import {
  agentHubMirrorBotChatName,
  agentHubMirrorBotRuns,
  type AgentHubMirrorBotChat
} from './agent-hub-mirror-bot-chat'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'

export type AgentHubMirrorBotPill = {
  id: string
  sessionId: string | null
  title: string
  active: boolean
  mark: 'ask' | 'work' | 'unread' | null
}

function pillMark(chat: BotChatTreeChat): AgentHubMirrorBotPill['mark'] {
  if (botChatNeedsOwner(chat)) {
    return 'ask'
  }
  if (chat.live === 'replying') {
    return 'work'
  }
  return chat.unread ? 'unread' : null
}

/** The bot's open chats: Home first, then the ones waiting on the owner, then the tree's own order. */
export function agentHubMirrorBotPills(
  chats: readonly BotChatTreeChat[],
  session: string | null
): AgentHubMirrorBotPill[] {
  const open = chats.filter((chat) => !chat.closed && !chat.run)
  const rank = (chat: BotChatTreeChat): number =>
    chat.origin === 'home' ? 0 : botChatNeedsOwner(chat) ? 1 : 2
  return open
    .map((chat, index) => ({ chat, index }))
    .sort((a, b) => rank(a.chat) - rank(b.chat) || a.index - b.index)
    .map(({ chat }) => ({
      id: chat.chatId,
      sessionId: chat.origin === 'home' ? null : chat.chatId,
      title: agentHubMirrorBotChatName(chat, chat.title),
      active: session !== null && (chat.chatId === session || chat.liveSessionId === session),
      mark: pillMark(chat)
    }))
}

function PillMark({ mark }: { mark: AgentHubMirrorBotPill['mark'] }): React.JSX.Element | null {
  if (mark === 'ask') {
    return <HubStateIndicator kind="ask" />
  }
  if (mark === 'work') {
    return <HubStateIndicator kind="work" />
  }
  return mark === 'unread' ? <HubStateIndicator kind="done" /> : null
}

/** The face, name and state line of the bot, its open chats as pills, and its page. */
export function AgentHubMirrorBotStripView({
  bot,
  line,
  pills,
  onSwitch,
  onNew,
  onOpenPage
}: {
  bot: Bot
  line: string
  pills: readonly AgentHubMirrorBotPill[]
  onSwitch: (pill: AgentHubMirrorBotPill) => void
  onNew: () => void
  onOpenPage: () => void
}): React.JSX.Element {
  const pageLabel = translate('agentHub.mirror.bot.openPage', 'Open bot page')
  const newLabel = translate('agentHub.orb.strip.new', 'New chat')
  return (
    <div
      data-agent-hub-mirror-bot-strip
      className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border px-3 py-1.5"
    >
      <AgentHubMirrorBotFace bot={bot} size={22} />
      <span className="min-w-0 max-w-44 shrink-0">
        <span className="block truncate text-xs font-semibold">{bot.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground first-letter:uppercase">
          {line}
        </span>
      </span>
      <div
        role="tablist"
        className="scrollbar-sleek ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {pills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            role="tab"
            aria-selected={pill.active}
            ref={
              pill.active
                ? (el) => el?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
                : undefined
            }
            onClick={() => {
              if (!pill.active) {
                onSwitch(pill)
              }
            }}
            className={cn(
              'flex h-6 max-w-40 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pill.active
                ? 'bg-foreground/[0.08] font-medium text-foreground'
                : 'text-muted-foreground hover:bg-foreground/[0.05]'
            )}
          >
            <PillMark mark={pill.mark} />
            <span className="truncate">{pill.title}</span>
          </button>
        ))}
        <AgentHubActionTooltip label={newLabel}>
          <Button
            type="button"
            variant="ghost-muted"
            size="icon-xs"
            className="shrink-0"
            aria-label={newLabel}
            onClick={onNew}
          >
            <Plus className="size-3" />
          </Button>
        </AgentHubActionTooltip>
      </div>
      <AgentHubActionTooltip label={pageLabel}>
        <Button
          type="button"
          variant="ghost-muted"
          size="icon-xs"
          className="shrink-0"
          aria-label={pageLabel}
          onClick={onOpenPage}
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </AgentHubActionTooltip>
    </div>
  )
}

export function AgentHubMirrorBotStrip({
  target,
  botChat,
  thread
}: {
  target: AgentHubPaneTarget
  botChat: AgentHubMirrorBotChat
  thread: AgentPaneThread | null
}): React.JSX.Element {
  const { bot, sessionId } = botChat
  const chats = useBotChatTree(bot).chats
  const runs = agentHubMirrorBotRuns(bot, thread)
  return (
    <AgentHubMirrorBotStripView
      bot={bot}
      line={[runs.state, runs.provider, runs.model].filter(Boolean).join(' · ')}
      pills={agentHubMirrorBotPills(chats, sessionId)}
      onSwitch={(pill) => void showBotChatInMirror(target, bot, pill.sessionId)}
      onNew={() => void newBotChatInMirror(target, bot)}
      onOpenPage={() => void openBotPage(bot)}
    />
  )
}
