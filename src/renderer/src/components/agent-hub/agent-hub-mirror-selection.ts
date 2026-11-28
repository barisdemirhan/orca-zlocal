import { useSyncExternalStore } from 'react'

export type AgentHubMirrorSelection = {
  windowId: string
  tabId: string
  seq: number
  focusTerminal: boolean
  revealTab: boolean
}
let selection: AgentHubMirrorSelection = {
  windowId: '',
  tabId: '',
  seq: 0,
  focusTerminal: false,
  revealTab: false
}
const listeners = new Set<() => void>()

export function requestAgentHubMirrorSelection(
  windowId: string,
  tabId: string,
  focusTerminal = true,
  revealTab = true
): void {
  selection = { windowId, tabId, seq: selection.seq + 1, focusTerminal, revealTab }
  listeners.forEach((listener) => listener())
}

export function useAgentHubMirrorSelection(): AgentHubMirrorSelection {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => selection
  )
}
