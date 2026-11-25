import { useAgentHubBotAskSteps } from './use-agent-hub-bot-ask-steps'
import { AgentHubBotAskView, type AgentHubBotAskVariant } from './AgentHubBotAskView'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'

/** A bot item's waiting ask, answered in place: the pop-outs, Inbox, bubble, chat cards and Orb all
 *  mount this, and hold their answers in the same draft store as the Items panel. */
export function AgentHubBotAskBlock({
  bot,
  item,
  variant,
  actions,
  className
}: {
  bot: Bot
  item: BotItem
  variant?: AgentHubBotAskVariant
  actions?: React.ReactNode
  className?: string
}): React.JSX.Element | null {
  const ask = useAgentHubBotAskSteps(bot, item)
  return <AgentHubBotAskView ask={ask} variant={variant} actions={actions} className={className} />
}
