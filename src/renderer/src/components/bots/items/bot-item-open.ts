// Opening an item from outside the panel (a chat's item chip): that bot's Items tab shows it. The ask
// names its bot and is taken once, by that bot's panel, however often panels remount.
import { useEffect, useSyncExternalStore } from 'react'
import { botRefKey, type BotRef } from '@/lib/bot-hosts'
import { openBotHomeTab } from '@/lib/bot-catalog'
import { useAppStore } from '@/store'
import { closeAgentHubCanvas } from '../../agent-hub/agent-hub-canvas-store'
import type { Bot } from '../../../../../shared/bot-types'

type Request = { bot: string; uid: string }

let request: Request | null = null
const listeners = new Set<() => void>()

function announce(): void {
  listeners.forEach((listener) => listener())
}

export function openBotItem(bot: BotRef, uid: string): void {
  request = { bot: botRefKey(bot), uid }
  useAppStore.getState().setRightSidebarTab('bot-activity')
  useAppStore.getState().setRightSidebarOpen(true)
  announce()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Takes the ask for an item of `bot`, once, and hands its uid to `open`. */
export function useBotItemOpenRequest(bot: BotRef, open: (uid: string) => void): void {
  const pending = useSyncExternalStore(subscribe, () => request)
  const key = botRefKey(bot)
  useEffect(() => {
    if (pending && pending.bot === key && request === pending) {
      request = null
      announce()
      open(pending.uid)
    }
  }, [pending, key, open])
}

/** From outside the bot's workspace (the hub, a mirror): its Home opens first, so the panel is on screen. */
export async function openBotItemInHome(bot: Bot, uid: string): Promise<void> {
  if (await openBotHomeTab(bot)) {
    // An open canvas snaps the right sidebar back, so the panel would never show.
    closeAgentHubCanvas()
    openBotItem(bot, uid)
  }
}
