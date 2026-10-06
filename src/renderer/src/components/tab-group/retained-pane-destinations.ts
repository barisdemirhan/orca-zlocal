const homeByDestination = new WeakMap<HTMLElement, Set<() => void>>()

export function registerRetainedPaneDestination(
  destination: HTMLElement,
  returnHome: () => void
): () => void {
  const returns = homeByDestination.get(destination) ?? new Set()
  returns.add(returnHome)
  homeByDestination.set(destination, returns)
  return () => returns.delete(returnHome)
}

export function returnRetainedPaneDestinationHome(destination: HTMLElement): void {
  homeByDestination.get(destination)?.forEach((returnHome) => returnHome())
}
