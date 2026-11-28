import { useEffect, useRef } from 'react'
import type { FloatingTerminalPanelBounds } from './geometry/floating-terminal-panel-bounds'

const PLACE_EVENT = 'orca:floating-workspace-place'

/**
 * Asks the floating workspace to move to these bounds, as if the user had dragged it there.
 * Used by features that lay out floating windows together; a maximized panel stays as it is.
 */
export function requestFloatingWorkspaceBounds(bounds: FloatingTerminalPanelBounds): void {
  window.dispatchEvent(
    new CustomEvent<FloatingTerminalPanelBounds>(PLACE_EVENT, { detail: bounds })
  )
}

export function useFloatingWorkspacePlaceRequests(
  onPlace: (bounds: FloatingTerminalPanelBounds) => void
): void {
  // Why a ref, not useEffectEvent: the panel's tests drive these hooks without a React renderer.
  const onPlaceRef = useRef(onPlace)
  useEffect(() => {
    onPlaceRef.current = onPlace
  })
  useEffect(() => {
    const onRequest = (event: Event): void => {
      if (event instanceof CustomEvent && isBounds(event.detail)) {
        onPlaceRef.current(event.detail)
      }
    }
    window.addEventListener(PLACE_EVENT, onRequest)
    return () => window.removeEventListener(PLACE_EVENT, onRequest)
  }, [])
}

function isBounds(value: unknown): value is FloatingTerminalPanelBounds {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['left', 'top', 'width', 'height'].every(
      (key) => key in value && Number.isFinite(Reflect.get(value, key))
    )
  )
}
