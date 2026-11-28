// The Orb settings and the Orb bot describe one assistant: each open syncs the settings onto the bot, and an edit
// on the bot's page is written back so that sync does not undo it.
import type { Bot } from '../../../shared/bot-types'
import { AGENT_HUB_ORB_TINTS, type AgentHubOrbTint } from '../../../shared/agent-hub-orb-identity'
import { agentHubOrbPermissionSettingValue } from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import type { BotHostUpdates } from '../../../shared/rpc-contract/bots-params'

/** Each Orb tint's nearest swatch in the bot avatar picker. */
const TINT_AVATAR_COLORS: Record<AgentHubOrbTint, string> = {
  silver: '#ffffff',
  teal: '#b5e3d8',
  emerald: '#c5dfb5',
  violet: '#c9b8e8',
  rose: '#f4c4cf'
}

export function agentHubOrbTintAvatarColor(tint: AgentHubOrbTint): string {
  return TINT_AVATAR_COLORS[tint]
}

function tintOfAvatarColor(color: string | null | undefined): AgentHubOrbTint | null {
  return AGENT_HUB_ORB_TINTS.find((tint) => TINT_AVATAR_COLORS[tint] === color) ?? null
}

/** The avatar color the tint asks for; null keeps a color the owner picked that no tint matches. */
export function agentHubOrbAvatarColorUpdate(bot: Bot, tint: AgentHubOrbTint): string | null {
  const color = TINT_AVATAR_COLORS[tint]
  if (bot.avatarColor === color) {
    return null
  }
  return !bot.avatarColor || tintOfAvatarColor(bot.avatarColor) ? color : null
}

/** The Orb settings an edit on the Orb bot's page changes, read from the bot as it was saved. */
export function agentHubOrbSettingsFromBotEdit(
  bot: Bot,
  updates: BotHostUpdates
): Partial<AgentHubSettings> {
  const settings: Partial<AgentHubSettings> = {}
  if (updates.name !== undefined) {
    settings.agentHubOrbName = bot.name
  }
  if (updates.agent !== undefined) {
    settings.agentHubOrbAgent = bot.agent
  }
  if (updates.permissionMode !== undefined) {
    settings.agentHubOrbPermission = bot.permissionMode
      ? agentHubOrbPermissionSettingValue(bot.permissionMode)
      : undefined
  }
  if (updates.launch !== undefined || updates.agent !== undefined) {
    settings.agentHubOrbModel = bot.launch?.model ?? null
  }
  const tint = updates.avatarColor !== undefined ? tintOfAvatarColor(bot.avatarColor) : null
  if (tint) {
    settings.agentHubOrbTint = tint
  }
  return settings
}
