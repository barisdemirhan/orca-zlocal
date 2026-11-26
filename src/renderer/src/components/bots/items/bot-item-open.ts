// Opening an item from outside the panel (a chat's item chip): that bot's Items tab shows it. The ask
// names its bot (and the surface it is meant for) and is taken once, by that bot's panel on that
// surface, however often panels remount.
import { useEffect, useSyncExternalStore } from 'react'
import { botRefKey, type BotRef } from '@/lib/bot-hosts'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { useAppStore } from '@/store'
import { closeAgentHubCanvas } from '../../agent-hub/agent-hub-canvas-store'
import type { Bot } from '../../../../../shared/bot-types'

/** Where an ask is meant to open: a mirror window's Activity tab; the right sidebar's panel when unnamed. */
type Request = { bot: string; uid: string; surface: string | undefined }

let request: Request | null = null
const listeners = new Set<() => void>()

function announce(): void {
  listeners.forEach((listener) => listener())
}

export function openBotItem(bot: BotRef, uid: string): void {
  request = { bot: botRefKey(bot), uid, surface: undefined }
  useAppStore.getState().setRightSidebarTab('bot-activity')
  useAppStore.getState().setRightSidebarOpen(true)
  announce()
}

/** Asks one surface's Activity panel (not the right sidebar) to open the item. */
export function openBotItemOnSurface(bot: BotRef, uid: string, surface: string): void {
  request = { bot: botRefKey(bot), uid, surface }
  announce()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Takes the ask for an item of `bot` meant for `surface`, once, and hands its uid to `open`. */
export function useBotItemOpenRequest(
  bot: BotRef,
  open: (uid: string) => void,
  surface?: string
): void {
  const pending = useSyncExternalStore(subscribe, () => request)
  const key = botRefKey(bot)
  useEffect(() => {
    if (pending && pending.bot === key && pending.surface === surface && request === pending) {
      request = null
      announce()
      open(pending.uid)
    }
  }, [pending, key, surface, open])
}

/** From outside the bot's workspace (the hub, a mirror): its Home opens first, so the panel is on screen. */
export async function openBotItemInHome(bot: Bot, uid: string): Promise<void> {
  if (await openBotHomeTab(bot)) {
    // An open canvas snaps the right sidebar back, so the panel would never show.
    closeAgentHubCanvas()
    openBotItem(bot, uid)
  }
}
