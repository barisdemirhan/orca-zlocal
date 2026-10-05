import { useSyncExternalStore } from 'react'

// Whether the canvas (the page mirrors live on while its setting is on) is showing.
let open = false
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isAgentHubCanvasOpen(): boolean {
  return open
}

export function useAgentHubCanvasOpen(): boolean {
  return useSyncExternalStore(subscribe, isAgentHubCanvasOpen)
}

export function openAgentHubCanvas(): void {
  if (!open) {
    open = true
    emit()
  }
}

export function closeAgentHubCanvas(): void {
  if (open) {
    open = false
    emit()
  }
}
