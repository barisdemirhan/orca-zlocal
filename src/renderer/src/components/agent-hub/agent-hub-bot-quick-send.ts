import { botTarget } from '@/lib/bot-hosts'
import { openBotChat } from '@/lib/bot-catalog'
import { sendStructuredAgentSessionMessage } from '../native-chat/session/structured/delivery/structured-agent-session-message-sender'
import type { Bot } from '../../../../shared/bot-types'

/** Sends `text` to the bot's Home Chat without opening it; a busy chat holds it as a queued card. */
export async function sendToBotHomeChat(bot: Bot, text: string): Promise<boolean> {
  const sessionId = await openBotChat(bot)
  const sent = sendStructuredAgentSessionMessage({
    sessionId,
    target: botTarget(bot),
    text,
    delivery: 'queue-if-active'
  })
  return sent !== null && (await sent.outcome) === 'recorded'
}
