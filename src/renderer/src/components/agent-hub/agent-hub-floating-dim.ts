import { useEffect, useSyncExternalStore } from 'react'

// How many floating windows carry the dim switch right now; the backdrop shows only over them.
let floatingCount = 0
// HazeOver-style: the dim follows attention. A click behind the floating windows lifts it, and a
// click on one (or a window opening) brings it back. The lamp setting itself stays on.
let spotlit = true
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
    spotlit = true
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

export function useFloatingWindowsSpotlit(): boolean {
  return useSyncExternalStore(subscribe, () => spotlit)
}

export function setFloatingWindowsSpotlit(next: boolean): void {
  if (spotlit !== next) {
    spotlit = next
    emit()
  }
}
