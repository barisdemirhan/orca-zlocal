import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()

export function setAgentHubShortcutsOpen(value: boolean): void {
  open = value
  listeners.forEach((listener) => listener())
}

export function openAgentHubShortcuts(): void {
  // Let the menu finish restoring focus before the dialog takes it.
  requestAnimationFrame(() => setAgentHubShortcutsOpen(true))
}

export function useAgentHubShortcutsOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => open
  )
}
