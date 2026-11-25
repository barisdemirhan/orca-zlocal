import { useSyncExternalStore } from 'react'
import { botRefKey, type BotRef } from '@/lib/bot-hosts'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'

/** An ask a "Send now" only partly answered: the item left Needs you, but lines are still open. */
export type AgentHubPartialBotAsk = {
  bot: Bot
  item: BotItem
  askId: string
  /** Question lines still waiting after the send. */
  remaining: number
}

const NONE: readonly AgentHubPartialBotAsk[] = []
const partials = new Map<string, AgentHubPartialBotAsk>()
let snapshot: readonly AgentHubPartialBotAsk[] = NONE
const listeners = new Set<() => void>()

const keyOf = (bot: BotRef, uid: string): string => `${botRefKey(bot)}\0${uid}`

function announce(): void {
  snapshot = partials.size === 0 ? NONE : [...partials.values()]
  listeners.forEach((listener) => listener())
}

export function keepAgentHubBotAskOpen(
  bot: Bot,
  item: BotItem,
  askId: string,
  remaining: number
): void {
  partials.set(keyOf(bot, item.uid), { bot, item, askId, remaining })
  announce()
}

export function releaseAgentHubBotAskOpen(bot: BotRef, uid: string): void {
  if (partials.delete(keyOf(bot, uid))) {
    announce()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAgentHubPartialBotAsks(): readonly AgentHubPartialBotAsk[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  )
}
