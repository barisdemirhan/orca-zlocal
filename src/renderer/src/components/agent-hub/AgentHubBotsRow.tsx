import { Server } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { BotAvatar } from '../bots/BotAvatar'
import {
  BotAvatarStatusBadge,
  botAvatarBadgeCutout,
  useBotAvatarBadgeSleeping
} from '../bots/bot-avatar-status-badge'
import type { useBotRowDetails } from '../bots/BotHoverDetails'
import { usageLimitStopTip } from '../bots/BotUsageLimitMark'
import type { Bot } from '../../../../shared/bot-types'

type BotDetails = ReturnType<typeof useBotRowDetails>

/** The bot's face with its status badge cut into the corner, as the sidebar row draws it. */
export function AgentHubBotFace({
  bot,
  details,
  live = null,
  className = 'size-8 rounded-md text-sm'
}: {
  bot: Bot
  details: BotDetails
  /** A chat waiting or replying shows over the quiet and sleeping badges. */
  live?: 'permission' | 'working' | null
  className?: string
}): React.JSX.Element {
  const t = useTranslate()
  const { workspaceId, status, offline, limit } = details
  const shown = offline ? null : (live ?? status)
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
