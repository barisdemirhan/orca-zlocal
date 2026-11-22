import { useSyncExternalStore } from 'react'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import type { Suggestion } from '../../../../shared/bots/bot-look-around'
import type { HostAccessRequest } from '@/lib/bot-access-requests'
import type { BotConnectorEntry } from '../bots/bot-connector-entries'

/** What one bot waits on the owner for, beyond the chats and workers the hub lists as threads. */
export type AgentHubBotNeeds = {
  bot: Bot
  botKey: string
  /** Items in Needs you that are neither stale nor snoozed. */
  items: readonly BotItem[]
  connectors: readonly { key: string; connector: BotConnectorEntry }[]
  access: readonly HostAccessRequest[]
  suggestions: readonly Suggestion[]
  /** Items, sign-ins and access requests: what the Inbox and the dock count. */
  count: number
}

const NO_NEEDS: readonly AgentHubBotNeeds[] = []

// Per-bot snapshots published by the mounted watchers: the Inbox, the counts and the alerts read one copy.
const published = new Map<string, AgentHubBotNeeds>()
let list: readonly AgentHubBotNeeds[] = NO_NEEDS
let total = 0
const listeners = new Set<() => void>()

function recompute(): void {
  list = published.size === 0 ? NO_NEEDS : [...published.values()]
  total = list.reduce((sum, needs) => sum + needs.count, 0)
  listeners.forEach((listener) => listener())
}

export function publishAgentHubBotNeeds(needs: AgentHubBotNeeds): () => void {
  published.set(needs.botKey, needs)
  recompute()
  return () => {
    if (published.get(needs.botKey) === needs) {
      published.delete(needs.botKey)
      recompute()
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAgentHubBotNeedsList(): readonly AgentHubBotNeeds[] {
  return useSyncExternalStore(
    subscribe,
    () => list,
    () => list
  )
}

/** Bot needs the hub's Inbox shows, summed over every bot a watcher is mounted for. */
export function useAgentHubBotNeedsTotal(): number {
  return useSyncExternalStore(
    subscribe,
    () => total,
    () => total
  )
}
