import { AgentHubOrbBotFace } from './AgentHubOrbBotFace'
import { BotAvatar } from '../bots/BotAvatar'
import type { Bot } from '../../../../shared/bot-types'

/** The bot's face at any size: the Orb's sphere for the Orb bot, else its avatar. */
export function AgentHubMirrorBotFace({
  bot,
  size
}: {
  bot: Bot
  size: number
}): React.JSX.Element {
  return bot.role === 'orb' ? (
    <AgentHubOrbBotFace bot={bot} sphere={{ phase: 'idle', label: bot.name }} size={size} />
  ) : (
    <BotAvatar
      bot={bot}
      className="shrink-0 rounded-md text-[10px]"
      style={{ width: size, height: size }}
    />
  )
}
