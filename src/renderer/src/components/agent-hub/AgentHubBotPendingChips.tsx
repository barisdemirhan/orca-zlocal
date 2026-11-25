import { translate } from '@/i18n/i18n'
import { BotAvatar } from '../bots/BotAvatar'
import type { Bot } from '../../../../shared/bot-types'

/** Past this many waiting bots the chips fold into faces and one "+N bots" chip. */
export const AGENT_HUB_BOT_CHIP_LIMIT = 5

const CHIP =
  'flex items-center gap-2 rounded-full border border-agent-question/45 bg-popover py-1 pr-3 pl-1 text-xs text-popover-foreground shadow-floating outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50'

/** A bot with something pending, parked: face, "Scotty · 1 question" and the count. */
export function AgentHubBotPendingChip({
  bot,
  count,
  onOpen
}: {
  bot: Bot
  count: number
  onOpen: () => void
}): React.JSX.Element {
  return (
    <button type="button" data-agent-hub-bot-chip={bot.id} className={CHIP} onClick={onOpen}>
      <BotAvatar bot={bot} className="size-6 rounded-full text-[11px]" />
      <span className="font-semibold">{bot.name}</span>
      <span className="text-muted-foreground">
        {count === 1
          ? translate('agentHub.botBubble.chipOne', '1 question')
          : translate('agentHub.botBubble.chipMany', '{{value0}} questions', { value0: count })}
      </span>
      <span className="ml-1 grid min-w-5 place-items-center rounded-full bg-agent-question px-1 text-[11px] font-semibold text-white tabular-nums">
        {count}
      </span>
    </button>
  )
}

/** Many waiting bots: their faces and "+3 bots · Open Inbox" instead of a chip each. */
export function AgentHubBotMoreChip({
  bots,
  hidden,
  onOpenInbox
}: {
  bots: readonly Bot[]
  hidden: number
  onOpenInbox: () => void
}): React.JSX.Element {
  return (
    <button type="button" data-agent-hub-bot-more className={CHIP} onClick={onOpenInbox}>
      <span className="flex -space-x-2">
        {bots.slice(0, AGENT_HUB_BOT_CHIP_LIMIT).map((bot) => (
          <BotAvatar
            key={bot.id}
            bot={bot}
            className="size-6 rounded-full text-[11px] ring-2 ring-popover"
          />
        ))}
      </span>
      <span className="font-semibold">
        {translate('agentHub.botBubble.moreBots', '+{{value0}} bots', { value0: hidden })}
      </span>
      <span className="text-muted-foreground">
        {translate('agentHub.botBubble.openInboxChip', 'Open Inbox')}
      </span>
    </button>
  )
}

export type AgentHubBotChipEntry = { bot: Bot; botKey: string; count: number }

/** The chips of bots whose bubbles are parked: one each, folded into "+N bots" past the limit. */
export function AgentHubBotChipRow({
  entries,
  onOpenBot,
  onOpenInbox
}: {
  entries: readonly AgentHubBotChipEntry[]
  onOpenBot: (entry: AgentHubBotChipEntry) => void
  onOpenInbox: () => void
}): React.JSX.Element | null {
  if (entries.length === 0) {
    return null
  }
  if (entries.length > AGENT_HUB_BOT_CHIP_LIMIT) {
    return (
      <AgentHubBotMoreChip
        bots={entries.map((entry) => entry.bot)}
        hidden={entries.length - AGENT_HUB_BOT_CHIP_LIMIT}
        onOpenInbox={onOpenInbox}
      />
    )
  }
  return (
    <>
      {entries.map((entry) => (
        <AgentHubBotPendingChip
          key={entry.botKey}
          bot={entry.bot}
          count={entry.count}
          onOpen={() => onOpenBot(entry)}
        />
      ))}
    </>
  )
}
