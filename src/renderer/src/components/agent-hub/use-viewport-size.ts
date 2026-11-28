import { useSyncExternalStore } from 'react'

function subscribeViewport(listener: () => void): () => void {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}
const viewportKey = (): string => `${window.innerWidth}x${window.innerHeight}`

/** The window's inner size, re-rendering on resize. */
export function useViewportSize(): { width: number; height: number } {
  const key = useSyncExternalStore(subscribeViewport, viewportKey)
  const [width, height] = key.split('x').map(Number)
  return { width: width ?? 0, height: height ?? 0 }
}
