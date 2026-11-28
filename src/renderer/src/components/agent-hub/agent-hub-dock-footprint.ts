import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react'

/** The folded bottom dock's box in window pixels; the hover bar is ignored so layouts hold still. */
export type AgentHubDockFootprint = { left: number; right: number; top: number }

// Keeps the dock's footer neighbours (e.g. a chat's composer row) readable above the notch.
const CLEARANCE_GAP_PX = 4

let footprint: AgentHubDockFootprint | null = null
const listeners = new Set<() => void>()

function publish(next: AgentHubDockFootprint | null): void {
  if (
    next === footprint ||
    (next &&
      footprint &&
      next.left === footprint.left &&
      next.right === footprint.right &&
      next.top === footprint.top)
  ) {
    return
  }
  footprint = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Called by the dock: its folded box while on the bottom edge, null elsewhere or unmounted. */
export function usePublishAgentHubDockFootprint(next: AgentHubDockFootprint | null): void {
  const { left, right, top } = next ?? { left: 0, right: 0, top: 0 }
  const present = next !== null
  useLayoutEffect(() => {
    publish(present ? { left, right, top } : null)
  }, [present, left, right, top])
  useLayoutEffect(() => () => publish(null), [])
}

/** Bottom padding that keeps `ref`'s content clear of the bottom dock when the dock overlaps it. */
export function useAgentHubDockBottomClearance(ref: RefObject<HTMLElement | null>): number {
  const dock = useSyncExternalStore(subscribe, () => footprint)
  const [clearance, setClearance] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!dock || !element) {
      setClearance(0)
      return
    }
    const measure = (): void => {
      const rect = element.getBoundingClientRect()
      const overlaps = rect.left < dock.right && rect.right > dock.left && rect.bottom > dock.top
      setClearance(overlaps ? Math.ceil(rect.bottom - dock.top) + CLEARANCE_GAP_PX : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [dock, ref])
  return clearance
}
