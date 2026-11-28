import { useSyncExternalStore } from 'react'

let parked: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function emit(next: ReadonlySet<string>): void {
  parked = next
  for (const listener of listeners) {
    listener()
  }
}

/** A bot whose bubble was put off with Later while it still waits: a chip stands in for it. */
export function parkAgentHubBot(botKey: string): void {
  if (!parked.has(botKey)) {
    emit(new Set([...parked, botKey]))
  }
}

export function unparkAgentHubBots(botKeys: Iterable<string>): void {
  const next = new Set(parked)
  for (const key of botKeys) {
    next.delete(key)
  }
  if (next.size !== parked.size) {
    emit(next)
  }
}

export function useAgentHubParkedBots(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => parked
  )
}
