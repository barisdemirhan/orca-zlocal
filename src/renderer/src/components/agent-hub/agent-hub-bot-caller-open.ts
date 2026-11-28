import { readBots } from '@/lib/bot-catalog'
import type { AgentHubCaller } from '../../../../shared/agent-hub-requests'
import { openBotSession } from '../bots/bot-session-open'

/** Opens the bot chat a request came from; false when one of a bot's chats did not send it. */
export function openAgentHubBotCaller(host: string, caller: AgentHubCaller): boolean {
  const { botId, sessionId } = caller
  if (!botId || !sessionId) {
    return false
  }
  // Request hosts name a paired server by its environment id; listed bots carry `runtime:<id>`.
  const hostId = host === 'local' ? host : `runtime:${host}`
  const bot = readBots().find((entry) => entry.id === botId && entry.hostId === hostId)
  if (!bot) {
    return false
  }
  openBotSession(bot, sessionId)
  return true
}
