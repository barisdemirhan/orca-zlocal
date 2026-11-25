import { readBots, readBotsEnabled } from '@/lib/bot-catalog'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { findBotByWorkspace } from '../bots/bot-workspace'
import type { AgentHubSurfaceSettings } from '../../../../shared/agent-hub-surface-settings'

/** The bot's name for a desktop notification of its own chat, only while the owner chose to see it. */
export function botNameForDesktopNotification(
  state: { settings: (AgentHubSurfaceSettings & { experimentalAgentHub?: boolean }) | null },
  workspaceId: string
): { botName?: string } {
  if (
    state.settings?.experimentalAgentHub !== true ||
    !readBotsEnabled() ||
    !agentHubSurfaceSetting(state.settings, 'agentHubBotNameInDesktopNotifications')
  ) {
    return {}
  }
  const bot = findBotByWorkspace(readBots(), workspaceId)
  return bot ? { botName: bot.name } : {}
}
