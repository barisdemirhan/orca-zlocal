import { useSyncExternalStore } from 'react'
let highlight: { key: string; seq: number } = { key: '', seq: 0 }
const highlightListeners = new Set<() => void>()
let dockRequest: { seq: number; key: string | null } = { seq: 0, key: null }
const dockListeners = new Set<() => void>()

export function useAgentHubMirrorHighlight(): { key: string; seq: number } {
  return useSyncExternalStore(
    (listener) => {
      highlightListeners.add(listener)
      return () => highlightListeners.delete(listener)
    },
    () => highlight
  )
}

export function requestAgentHubMirrorsDock(id: string | null = null): void {
  dockRequest = { seq: dockRequest.seq + 1, key: id }
  dockListeners.forEach((listener) => listener())
}
export function useAgentHubMirrorsDockRequest(): { seq: number; key: string | null } {
  return useSyncExternalStore(
    (listener) => {
      dockListeners.add(listener)
      return () => dockListeners.delete(listener)
    },
    () => dockRequest
  )
}
export function highlightAgentHubMirror(id: string): void {
  highlight = { key: id, seq: highlight.seq + 1 }
  highlightListeners.forEach((listener) => listener())
}
