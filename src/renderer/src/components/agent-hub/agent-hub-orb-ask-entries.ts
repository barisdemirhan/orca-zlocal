import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import type { AgentHubBotNeeds } from './agent-hub-bot-needs-store'

export type OrbAskEntry = {
  key: string
  /** Names the ask itself, so a newer ask on the item calls again after Later. */
  askKey: string
  bot: Bot
  item: BotItem
  own: boolean
}

/** The asks that wait on the owner, the Orb's own first; other bots' only when the setting shows them. */
export function orbAskEntries(
  needs: readonly AgentHubBotNeeds[],
  otherBots: boolean
): OrbAskEntry[] {
  const own: OrbAskEntry[] = []
  const others: OrbAskEntry[] = []
  for (const entry of needs) {
    const isOrb = entry.bot.role === 'orb'
    if (!isOrb && !otherBots) {
      continue
    }
    for (const item of entry.items) {
      const key = `${entry.botKey}:${item.uid}`
      const askKey = `${key}:${item.waitingAsk ?? item.question?.eventId ?? ''}`
      const row = { key, askKey, bot: entry.bot, item, own: isOrb }
      ;(isOrb ? own : others).push(row)
    }
  }
  return [...own, ...others]
}
