import type { AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubBotIdentity } from './agent-hub-bot-identity'

export type AgentHubBotFamilyMember<T> = { item: T; identity: AgentHubBotIdentity }

export type AgentHubBotTrayEntry<T> =
  | { type: 'chip'; key: string; item: T }
  | {
      type: 'family'
      key: string
      bot: AgentHubBotIdentity['bot']
      members: readonly AgentHubBotFamilyMember<T>[]
    }

// The family chip speaks for its loudest member: a question, then work going, then a result.
const LOUDNESS: Record<AgentHubIndicatorKind, number> = {
  ask: 0,
  work: 1,
  done: 2,
  read: 3,
  idle: 4
}

export function loudestAgentHubFamilyKind(
  kinds: readonly AgentHubIndicatorKind[]
): AgentHubIndicatorKind {
  return kinds.reduce((loudest, kind) => (LOUDNESS[kind] < LOUDNESS[loudest] ? kind : loudest))
}

/**
 * Two or more parked chips of one bot become a single family entry at the place of the first
 * (most urgent) one; a bot with a single chip keeps it as it is.
 */
export function groupAgentHubBotFamilies<T extends { key: string }>(
  items: readonly T[],
  identityOf: (key: string) => AgentHubBotIdentity | undefined
): AgentHubBotTrayEntry<T>[] {
  const byBot = new Map<string, AgentHubBotFamilyMember<T>[]>()
  for (const item of items) {
    const identity = identityOf(item.key)
    if (identity) {
      byBot.set(identity.bot.id, [...(byBot.get(identity.bot.id) ?? []), { item, identity }])
    }
  }
  const entries: AgentHubBotTrayEntry<T>[] = []
  const placed = new Set<string>()
  for (const item of items) {
    const botId = identityOf(item.key)?.bot.id
    const members = botId ? byBot.get(botId) : undefined
    if (!botId || !members || members.length < 2) {
      entries.push({ type: 'chip', key: item.key, item })
    } else if (!placed.has(botId)) {
      placed.add(botId)
      entries.push({
        type: 'family',
        key: `bot-family:${botId}`,
        bot: members[0].identity.bot,
        members
      })
    }
  }
  return entries
}
