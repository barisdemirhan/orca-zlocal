import { useSyncExternalStore } from 'react'

// Why module scope: the pane's chrome remounts on splits and tab switches, and a card the user
// closed must stay closed until the agent asks something else.
const dismissed = new Map<string, number>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Closes the pane's card for the prompt that began at `stateSince`. */
export function dismissAgentHubPaneQuickReply(paneKey: string, stateSince: number): void {
  dismissed.set(paneKey, stateSince)
  listeners.forEach((listener) => listener())
}

export function useAgentHubPaneQuickReplyDismissed(paneKey: string, stateSince: number): boolean {
  return useSyncExternalStore(subscribe, () => dismissed.get(paneKey) === stateSince)
}

export function resetAgentHubPaneQuickReplyDismissalsForTest(): void {
  dismissed.clear()
  listeners.forEach((listener) => listener())
}
