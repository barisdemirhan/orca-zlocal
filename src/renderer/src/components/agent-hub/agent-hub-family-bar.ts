import { useSyncExternalStore } from 'react'

// Families (by their top dispatcher's pane) whose worker bar the user tucked away, this session.
let hidden: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toggleAgentHubFamilyBar(rootPaneKey: string): void {
  const next = new Set(hidden)
  if (!next.delete(rootPaneKey)) {
    next.add(rootPaneKey)
  }
  hidden = next
  listeners.forEach((listener) => listener())
}

/** Whether this family's worker bar shows; every mirror of the family follows the same switch. */
export function useAgentHubFamilyBarShown(rootPaneKey: string | null): boolean {
  return useSyncExternalStore(subscribe, () => rootPaneKey === null || !hidden.has(rootPaneKey))
}
