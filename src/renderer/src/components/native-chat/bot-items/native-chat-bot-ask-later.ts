import { useSyncExternalStore } from 'react'
import { botRefKey, type BotRef } from '@/lib/bot-hosts'

// "Later" on a chat's ask card hides it for that ask on this device, until the transcript's Answer
// brings it back; a newer ask on the item shows again. Kept in memory.
const hidden = new Map<string, string>()
const listeners = new Set<() => void>()

function itemKey(bot: BotRef, uid: string): string {
  return `${botRefKey(bot)}\0${uid}`
}

let version = 0

function announce(): void {
  version += 1
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function hideBotAskCard(bot: BotRef, uid: string, askId: string): void {
  hidden.set(itemKey(bot, uid), askId)
  announce()
}

export function showBotAskCard(bot: BotRef, uid: string): void {
  if (hidden.delete(itemKey(bot, uid))) {
    announce()
  }
}

/** Forgets the hidden asks of items that no longer wait on that ask, so the transcript's Answer goes. */
export function pruneHiddenBotAsks(
  bot: BotRef,
  waiting: ReadonlyMap<string, string | undefined>
): void {
  const prefix = `${botRefKey(bot)}\0`
  let changed = false
  for (const [key, askId] of hidden) {
    if (key.startsWith(prefix) && waiting.get(key.slice(prefix.length)) !== askId) {
      hidden.delete(key)
      changed = true
    }
  }
  if (changed) {
    announce()
  }
}

/** The ask a chat's card hid for the item, if any. */
export function useHiddenBotAsk(bot: BotRef | null, uid: string): string | undefined {
  const read = (): string | undefined => (bot ? hidden.get(itemKey(bot, uid)) : undefined)
  return useSyncExternalStore(subscribe, read, read)
}

/** Bumps whenever any card is hidden or shown, for lists that count the hidden ones. */
export function useHiddenBotAsksVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version
  )
}

export function readHiddenBotAsk(bot: BotRef, uid: string): string | undefined {
  return hidden.get(itemKey(bot, uid))
}
