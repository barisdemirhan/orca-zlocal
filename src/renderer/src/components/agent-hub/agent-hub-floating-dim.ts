import { useEffect, useSyncExternalStore } from 'react'

// How many floating windows carry the dim switch right now; the backdrop shows only over them.
let floatingCount = 0
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Marks a floating window as on screen while the caller is mounted and `showing`. */
export function useFloatingWindowPresence(showing: boolean): void {
  useEffect(() => {
    if (!showing) {
      return
    }
    floatingCount += 1
    emit()
    return () => {
      floatingCount -= 1
      emit()
    }
  }, [showing])
}

export function useAnyFloatingWindowOpen(): boolean {
  return useSyncExternalStore(subscribe, () => floatingCount > 0)
}
