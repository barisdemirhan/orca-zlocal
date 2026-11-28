import { useSyncExternalStore } from 'react'

// Per session on purpose: a "mute bots only" that outlived the app would silently hide bot asks.
let botsMutedUntil: number | null = null
const listeners = new Set<() => void>()

export function muteAgentHubBotAlertsUntil(until: number | null): void {
  botsMutedUntil = until
  listeners.forEach((listener) => listener())
}

export function useAgentHubBotAlertsMutedUntil(): number | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => botsMutedUntil
  )
}

/** Whether bot alerts are silenced, by the all-alerts mute or the bots-only one. */
export function agentHubBotAlertsMuted(generalUntil: number | null | undefined): boolean {
  const now = Date.now()
  return (generalUntil ?? 0) > now || (botsMutedUntil ?? 0) > now
}

export function useAgentHubBotAlertsMutedNow(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (botsMutedUntil ?? 0) > Date.now()
  )
}
