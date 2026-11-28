import { Check, ChevronDown, Home, Maximize2, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import type { Bot } from '../../../../shared/bot-types'
import { useBotChatTree } from '../bots/use-bot-chat-tree'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { AgentHubMirrorBotFace } from './AgentHubMirrorBotFace'
import { HubStateIndicator } from './AgentHubStateMarks'
import { newBotChatInMirror, showBotChatInMirror } from './agent-hub-bot-mirror'
import { openBotPage } from './agent-hub-bot-page-open'
import { agentHubMirrorBotRuns, type AgentHubMirrorBotChat } from './agent-hub-mirror-bot-chat'
import { agentHubMirrorBotPills, type AgentHubMirrorBotPill } from './agent-hub-mirror-bot-pills'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function PillMark({ pill }: { pill: AgentHubMirrorBotPill }): React.JSX.Element | null {
  if (pill.active) {
    return <Check aria-hidden className="size-3.5" />
  }
  if (pill.mark === 'ask' || pill.mark === 'work') {
    return <HubStateIndicator kind={pill.mark} />
  }
  if (pill.mark === 'unread') {
    return <HubStateIndicator kind="done" />
  }
  return pill.sessionId === null ? <Home aria-hidden className="size-3.5" /> : null
}

function PillHint({ mark }: { mark: AgentHubMirrorBotPill['mark'] }): React.JSX.Element | null {
  if (mark === 'ask') {
    return (
      <span className="shrink-0 text-[11px] text-agent-question">
        {translate('agentHub.card.asking', 'asking')}
      </span>
    )
  }
  return mark === 'work' ? (
    <span className="shrink-0 text-[11px] text-muted-foreground">
      {translate('agentHub.state.working', 'working')}
    </span>
  ) : null
}

/** The open chat's name as a menu trigger: the bot's other chats, a new chat and the bot's page. */
export function AgentHubMirrorBotChatSwitcherView({
  bot,
  line,
  title,
  progress,
  pills,
  onSwitch,
  onNew,
  onOpenPage
}: {
  bot: Bot
  line: string
  title: string
  progress: string | null
  pills: readonly AgentHubMirrorBotPill[]
  onSwitch: (pill: AgentHubMirrorBotPill) => void
  onNew: () => void
  onOpenPage: () => void
}): React.JSX.Element {
  const waiting = pills.filter((pill) => pill.mark === 'ask' && !pill.active).length
  const waitingLabel = translate(
    'agentHub.mirror.bot.chatsWaiting',
    'Chats waiting for you: {{value0}}',
    {
      value0: waiting
    }
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-agent-hub-no-tab-drop
          onPointerDown={(event) => event.stopPropagation()}
          className="group/switch flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[13px] leading-tight text-foreground outline-none hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/[0.08]"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">{title}</span>
            {progress ? (
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                {progress}
              </span>
            ) : null}
          </span>
          <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          {waiting > 0 ? (
            <span
              role="img"
              aria-label={waitingLabel}
              title={waitingLabel}
              className="flex h-4.5 shrink-0 items-center gap-1 rounded-full bg-agent-question/15 px-1.5 text-[11px] font-medium text-agent-question tabular-nums"
            >
              <HubStateIndicator kind="ask" />
              {waiting}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <AgentHubMirrorBotFace bot={bot} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{bot.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground first-letter:uppercase">
              {line}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{translate('agentHub.bots.family.chats', 'Chats')}</DropdownMenuLabel>
        <div className="scrollbar-sleek max-h-64 overflow-y-auto">
          {pills.map((pill) => (
            <DropdownMenuItem
              key={pill.id}
              data-active={pill.active}
              onSelect={() => {
                if (!pill.active) {
                  onSwitch(pill)
                }
              }}
              className={cn('gap-2', pill.active && 'font-medium')}
            >
              <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
                <PillMark pill={pill} />
              </span>
              <span className="min-w-0 flex-1 truncate">{pill.title}</span>
              <PillHint mark={pill.mark} />
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onNew} className="gap-2">
          <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
            <Plus aria-hidden className="size-3.5" />
          </span>
          {translate('agentHub.orb.strip.new', 'New chat')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenPage} className="gap-2">
          <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
            <Maximize2 aria-hidden className="size-3.5" />
          </span>
          {translate('agentHub.mirror.bot.openPage', 'Open bot page')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AgentHubMirrorBotChatSwitcher({
  target,
  botChat,
  thread,
  title,
  progress
}: {
  target: AgentHubPaneTarget
  botChat: AgentHubMirrorBotChat
  thread: AgentPaneThread | null
  title: string
  progress: string | null
}): React.JSX.Element {
  const { bot, sessionId } = botChat
  const chats = useBotChatTree(bot).chats
  const runs = agentHubMirrorBotRuns(bot, thread)
  return (
    <AgentHubMirrorBotChatSwitcherView
      bot={bot}
      line={[runs.state, runs.provider, runs.model].filter(Boolean).join(' · ')}
      title={title}
      progress={progress}
      pills={agentHubMirrorBotPills(chats, sessionId)}
      onSwitch={(pill) => void showBotChatInMirror(target, bot, pill.sessionId)}
      onNew={() => void newBotChatInMirror(target, bot)}
      onOpenPage={() => void openBotPage(bot)}
    />
  )
}
