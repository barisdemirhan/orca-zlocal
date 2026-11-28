import { useEffect, useRef } from 'react'

/** The key to select after the selected row vanished: the row now standing where it stood, else the last one. */
export function nearestAgentHubRowKey(
  previousKeys: readonly string[],
  nextKeys: readonly string[],
  selectedKey: string | null
): string | null {
  if (selectedKey === null || nextKeys.includes(selectedKey)) {
    return selectedKey
  }
  const at = previousKeys.indexOf(selectedKey)
  if (at === -1) {
    return null
  }
  const present = new Set(nextKeys)
  const after = previousKeys.slice(at + 1).find((key) => present.has(key))
  const before = previousKeys
    .slice(0, at)
    .toReversed()
    .find((key) => present.has(key))
  return after ?? before ?? null
}

/** Moves a selection whose row disappeared to the nearest surviving row instead of dropping it. */
export function useNearestAgentHubSelection(
  keys: readonly string[],
  selectedKey: string | null,
  select: (key: string | null) => void
): void {
  const previous = useRef<readonly string[]>(keys)
  useEffect(() => {
    const before = previous.current
    previous.current = keys
    if (selectedKey !== null && !keys.includes(selectedKey)) {
      select(nearestAgentHubRowKey(before, keys, selectedKey))
    }
  }, [keys, selectedKey, select])
}
