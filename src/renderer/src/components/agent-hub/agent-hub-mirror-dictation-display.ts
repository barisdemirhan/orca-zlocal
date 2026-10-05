import { useEffect, useSyncExternalStore } from 'react'

// How many mirrors show the running dictation inside themselves right now.
let showingCount = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(): void {
  listeners.forEach((listener) => listener())
}

/** Marks a mirror as showing the dictation while the caller is mounted and `showing`. */
export function useMirrorShowsDictation(showing: boolean): void {
  useEffect(() => {
    if (!showing) {
      return
    }
    showingCount += 1
    emit()
    return () => {
      showingCount -= 1
      emit()
    }
  }, [showing])
}

/** Whether a mirror shows the dictation itself, so the app-wide indicator can stand down. */
export function useDictationShownInMirror(): boolean {
  return useSyncExternalStore(subscribe, () => showingCount > 0)
}
