/** Keeps rows where they are while the panel is open: known ids hold their place, new ones go last. */
export function holdAgentHubOrder(held: readonly string[], sorted: readonly string[]): string[] {
  const present = new Set(sorted)
  const kept = held.filter((id) => present.has(id))
  const known = new Set(kept)
  return [...kept, ...sorted.filter((id) => !known.has(id))]
}

export function sortByHeldOrder<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  held: readonly string[]
): T[] {
  const place = new Map(held.map((id, index) => [id, index]))
  return [...items].sort(
    (a, b) => (place.get(idOf(a)) ?? Infinity) - (place.get(idOf(b)) ?? Infinity)
  )
}
