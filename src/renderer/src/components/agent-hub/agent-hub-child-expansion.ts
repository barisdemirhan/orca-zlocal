import { useSyncExternalStore } from 'react'

// Why module scope: the panel remounts on every open, and a folded worker list should stay folded.
const MAX_EXPANDED = 256
let expanded: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toggleAgentHubChildren(parentKey: string): void {
  const next = new Set(expanded)
  if (next.has(parentKey)) {
    next.delete(parentKey)
  } else {
    next.add(parentKey)
    if (next.size > MAX_EXPANDED) {
      next.delete(next.values().next().value ?? parentKey)
    }
  }
  expanded = next
  listeners.forEach((listener) => listener())
}

/** Parent pane keys whose workers and subagents are unfolded. */
export function useAgentHubExpandedChildren(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => expanded)
}
