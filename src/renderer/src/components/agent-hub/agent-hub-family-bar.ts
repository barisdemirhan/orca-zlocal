import { useSyncExternalStore } from 'react'

// Families (by their top dispatcher's pane) whose worker bar the user tucked away.
let hidden: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

export function subscribeAgentHubFamilyBars(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readAgentHubHiddenFamilyBars(): ReadonlySet<string> {
  return hidden
}

/** Tucks these families' bars away at once, as the last session left them. */
export function setAgentHubHiddenFamilyBars(rootPaneKeys: readonly string[]): void {
  hidden = new Set(rootPaneKeys)
  listeners.forEach((listener) => listener())
}

export function toggleAgentHubFamilyBar(rootPaneKey: string): void {
  const next = new Set(hidden)
  if (!next.delete(rootPaneKey)) {
    next.add(rootPaneKey)
  }
  hidden = next
  listeners.forEach((listener) => listener())
}

export function showAgentHubFamilyBar(rootPaneKey: string): void {
  if (!hidden.has(rootPaneKey)) {
    return
  }
  const next = new Set(hidden)
  next.delete(rootPaneKey)
  hidden = next
  listeners.forEach((listener) => listener())
}

/** Whether this family's worker bar shows; every mirror of the family follows the same switch. */
export function useAgentHubFamilyBarShown(rootPaneKey: string | null): boolean {
  return useSyncExternalStore(
    subscribeAgentHubFamilyBars,
    () => rootPaneKey === null || !hidden.has(rootPaneKey)
  )
}
