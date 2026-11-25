import { useSyncExternalStore } from 'react'

// Per session on purpose, like the bots-only mute: one that outlived the app would hide asks.
const mutedUntilByKey = new Map<string, number>()
const listeners = new Set<() => void>()

export const AGENT_HUB_SENDER_MUTE_MS = 60 * 60_000

export function agentHubBotMuteKey(bot: { hostId: string; id: string }): string {
  return `bot:${bot.hostId}/${bot.id}`
}

export function agentHubPaneMuteKey(paneKey: string): string {
  return `pane:${paneKey}`
}

/** Silences one sender's hub alerts until `until`, or lifts it; its asks still reach the Inbox. */
export function muteAgentHubSenderUntil(key: string, until: number | null): void {
  if (until === null) {
    mutedUntilByKey.delete(key)
  } else {
    mutedUntilByKey.set(key, until)
  }
  listeners.forEach((listener) => listener())
}

export function agentHubSenderMuted(key: string | null): boolean {
  return key !== null && (mutedUntilByKey.get(key) ?? 0) > Date.now()
}

export function useAgentHubSenderMuted(key: string | null): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => agentHubSenderMuted(key)
  )
}
