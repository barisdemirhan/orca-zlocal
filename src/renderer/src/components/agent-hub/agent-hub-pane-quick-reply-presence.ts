import { useSyncExternalStore } from 'react'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'

// Panes whose quick-reply card is open; while one is, its mirror's mic leaves dictation to the card.
let openPaneKeys: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function publish(next: ReadonlySet<string>): void {
  openPaneKeys = next
  listeners.forEach((listener) => listener())
}

/** Marks the pane's card as open; returns the call that marks it closed. */
export function markAgentHubPaneQuickReplyOpen(paneKey: string): () => void {
  publish(new Set([...openPaneKeys, paneKey]))
  return () => publish(new Set([...openPaneKeys].filter((key) => key !== paneKey)))
}

/** Whether a card is open on this pane, or on any pane of the tab for a shell mirror (no key). */
export function useAgentHubPaneQuickReplyOpen(tabId: string, paneKey: string | null): boolean {
  return useSyncExternalStore(subscribe, () =>
    paneKey
      ? openPaneKeys.has(paneKey)
      : [...openPaneKeys].some((key) => parsePaneKey(key)?.tabId === tabId)
  )
}
