import { Bot as BotIcon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useBots } from '@/lib/bot-catalog'
import { usePublishedBotsNeedsYou } from '../bots/bot-needs-you-published'
import { DockButton, DOCK_COUNT_BUTTON } from './AgentHubDockParts'
import { useAgentHubBotsActive } from './agent-hub-bot-identity'
import type { AgentHubTab } from './agent-hub-keys'

/** The dock's robot slot: how many bots there are and, in orange, how many wait on the owner. */
export function AgentHubDockBotsSlot({
  side,
  onOpenTab
}: {
  side: 'top' | 'bottom' | 'left' | 'right'
  onOpenTab: (tab: AgentHubTab) => void
}): React.JSX.Element | null {
  const active = useAgentHubBotsActive()
  const bots = useBots(active)
  const needsYou = usePublishedBotsNeedsYou(bots)
  if (!active || bots.length === 0) {
    return null
  }
  return (
    <DockButton
      label={translate('agentHub.bots.dock', 'Bots')}
      side={side}
      className={DOCK_COUNT_BUTTON}
      onClick={() => onOpenTab('bots')}
    >
      <span
        data-agent-hub-bot-dock
        data-needs-you={needsYou}
        className="relative flex items-center gap-1 font-mono text-[11px] tabular-nums group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col"
      >
        <BotIcon aria-hidden className="size-3.5" />
        {bots.length}
        {needsYou > 0 ? (
          <span
            data-agent-hub-bot-dock-badge
            className="absolute -top-1.5 -right-2 grid min-w-3.5 place-items-center rounded-full bg-agent-question px-1 text-[9px] leading-3.5 font-semibold text-white"
          >
            {needsYou}
          </span>
        ) : null}
      </span>
    </DockButton>
  )
}
