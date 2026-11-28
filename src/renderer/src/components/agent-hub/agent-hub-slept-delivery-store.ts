import { useSyncExternalStore } from 'react'
import type { AgentSleptPrompt } from '../../../../shared/agent-status/contracts/agent-status-types'

export type SleptDelivery = {
  phase: 'waking' | 'sending' | 'sent' | 'failed'
  paneKey: string
  /** Waking drops the saved question from the pane's row, so the card reads it from here. */
  prompt: AgentSleptPrompt
  /** Kept on failure so Send again repeats exactly what the owner composed. */
  message: string
  error?: string
}

const deliveries = new Map<string, SleptDelivery>()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function sleptPromptKey(paneKey: string, prompt: AgentSleptPrompt): string {
  return `${paneKey}\u0000${prompt.savedAt}`
}

export function getSleptDelivery(key: string): SleptDelivery | undefined {
  return deliveries.get(key)
}

export function setSleptDelivery(key: string, delivery: SleptDelivery): void {
  deliveries.set(key, delivery)
  for (const listener of listeners) {
    listener()
  }
}

export function useSleptDelivery(key: string): SleptDelivery | undefined {
  return useSyncExternalStore(subscribe, () => deliveries.get(key))
}

/** The question of a pane's answer still on its way, or one that failed and can be sent again. */
export function unsettledSleptDeliveryPrompt(paneKey: string): AgentSleptPrompt | null {
  let latest: AgentSleptPrompt | null = null
  for (const delivery of deliveries.values()) {
    if (
      delivery.paneKey === paneKey &&
      delivery.phase !== 'sent' &&
      (!latest || delivery.prompt.savedAt > latest.savedAt)
    ) {
      latest = delivery.prompt
    }
  }
  return latest
}
