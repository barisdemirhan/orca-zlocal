import { ChevronRight, Server } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { BotAvatar } from '../bots/BotAvatar'
import {
  BotAvatarStatusBadge,
  botAvatarBadgeCutout,
  useBotAvatarBadgeSleeping
} from '../bots/bot-avatar-status-badge'
import { BotRowLineView } from '../bots/BotRowActivityLine'
import { useBotRowDetails } from '../bots/BotHoverDetails'
import { usageLimitStopTip } from '../bots/BotUsageLimitMark'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'

type BotDetails = ReturnType<typeof useBotRowDetails>

/** The bot's face with its status badge cut into the corner, as the sidebar row draws it. */
export function AgentHubBotFace({
  bot,
  details,
  className = 'size-8 rounded-md text-sm'
}: {
  bot: Bot
  details: BotDetails
  className?: string
}): React.JSX.Element {
  const t = useTranslate()
  const { workspaceId, status, offline, limit } = details
  const shown = offline ? null : status
  const badge = {
    status: shown,
    sleeping: useBotAvatarBadgeSleeping(workspaceId, shown),
    stopTip: !offline && limit ? usageLimitStopTip(t, limit.stop) : null
  }
  return (
    <span className="relative shrink-0">
      <span className="flex" style={botAvatarBadgeCutout(badge)}>
        <BotAvatar bot={bot} className={className} />
      </span>
      <BotAvatarStatusBadge {...badge} />
    </span>
  )
}

export function AgentHubBotHostChip({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      title={translate('agentHub.bots.tab.runsOn', 'Runs on {{host}}', { host: label })}
      className="inline-flex max-w-24 shrink-0 items-center gap-1 rounded-full bg-foreground/[0.06] px-1.5 text-[10px] leading-4 text-muted-foreground"
    >
      <Server aria-hidden className="size-2.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  )
}

export function AgentHubBotNeedsPill({ count }: { count: number }): React.JSX.Element | null {
  return count > 0 ? (
    <span
      data-agent-hub-bots-needs={count}
      title={translate('agentHub.bots.tab.needsYou', '{{count}} need you', { count })}
      className="grid min-w-4 shrink-0 place-items-center rounded-full bg-agent-question px-1.5 text-[10px] leading-4 font-semibold text-white"
    >
      {count}
    </span>
  ) : null
}

/** One bot in the Bots tab: a chevron that folds its tree, and a button that opens its page. */
export function AgentHubBotsRow({
  bot,
  home,
  needs,
  expanded,
  onToggle,
  onOpen
}: {
  bot: Bot
  home: FolderWorkspace
  needs: number
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
}): React.JSX.Element {
  const details = useBotRowDetails(bot, home)
  const { hostLabel, offline, line, limit, description, now } = details
  return (
    <div className="flex items-center gap-0.5 rounded-lg hover:bg-foreground/[0.04]">
      <button
        type="button"
        tabIndex={-1}
        data-agent-hub-bots-chevron
        aria-expanded={expanded}
        aria-label={translate('agentHub.bots.tab.toggleTree', 'Show {{name}}’s chats', {
          name: bot.name
        })}
        onClick={onToggle}
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
        />
      </button>
      <button
        type="button"
        tabIndex={-1}
        data-agent-hub-bots-row
        data-bot-id={bot.id}
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pr-2 text-left',
          (bot.paused || offline) && 'opacity-60'
        )}
      >
        <AgentHubBotFace bot={bot} details={details} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
              {bot.name}
            </span>
            {hostLabel ? <AgentHubBotHostChip label={hostLabel} /> : null}
          </span>
          <BotRowLineView
            line={line}
            limit={offline ? null : limit}
            fallback={description}
            unread={false}
            now={now}
            disconnected={offline}
          />
        </span>
        <AgentHubBotNeedsPill count={needs} />
      </button>
    </div>
  )
}
