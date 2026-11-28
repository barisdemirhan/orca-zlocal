import { BotAvatar } from '../bots/BotAvatar'
import type { Bot } from '../../../../shared/bot-types'
import { AgentHubOrbSphere, type AgentHubOrbSphereProps } from './AgentHubOrbSphere'

/** The Orb's face in a window header: its sphere in its current state, or the picture the owner chose. */
export function AgentHubOrbBotFace({
  bot,
  sphere,
  size
}: {
  bot: Bot | null
  sphere: AgentHubOrbSphereProps
  size: number
}): React.JSX.Element {
  return bot?.avatar ? (
    <BotAvatar bot={bot} className="shrink-0 rounded-md" style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}
      data-agent-hub-orb-face
    >
      <AgentHubOrbSphere {...sphere} decorative />
    </span>
  )
}
