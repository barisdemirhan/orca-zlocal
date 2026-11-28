import { useEffect, useRef } from 'react'

export const AGENT_HUB_ORB_HOLD_MS = 420
export const AGENT_HUB_ORB_DOUBLE_CLICK_MS = 230
const DRAG_PX = 5

type SphereGestureHandlers = {
  onClick: () => void
  onDoubleClick: () => void
  onHoldStart: () => void
  onHoldEnd: () => void
}

type Press = { x: number; y: number; moved: boolean; held: boolean }
type PointerPosition = Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>

/** Click, double click, press-and-hold and drag on one sphere; a drag or a hold never counts as a click. */
export function useAgentHubOrbSphereGestures(handlers: SphereGestureHandlers, enabled: boolean) {
  const latest = useRef(handlers)
  latest.current = handlers
  const press = useRef<Press | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearHold = (): void => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  useEffect(
    () => () => {
      clearHold()
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current)
      }
    },
    []
  )
  const release = (): void => {
    clearHold()
    const current = press.current
    if (current?.held) {
      latest.current.onHoldEnd()
    }
    // Why: the click that follows this release still needs the press; a release with no click must not.
    setTimeout(() => {
      if (press.current === current) {
        press.current = null
      }
    }, 0)
  }
  return {
    onPointerDown: (event: PointerPosition): void => {
      if (!enabled || event.button !== 0) {
        return
      }
      const current: Press = { x: event.clientX, y: event.clientY, moved: false, held: false }
      press.current = current
      clearHold()
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null
        if (press.current !== current || current.moved) {
          return
        }
        current.held = true
        latest.current.onHoldStart()
      }, AGENT_HUB_ORB_HOLD_MS)
    },
    onPointerMove: (event: PointerPosition): void => {
      const current = press.current
      if (!current || current.moved || current.held) {
        return
      }
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > DRAG_PX) {
        current.moved = true
        clearHold()
      }
    },
    onPointerUp: release,
    onPointerCancel: release,
    onClick: (): void => {
      const current = press.current
      press.current = null
      if (!enabled || current?.moved || current?.held) {
        return
      }
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current)
        clickTimer.current = null
        latest.current.onDoubleClick()
        return
      }
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        latest.current.onClick()
      }, AGENT_HUB_ORB_DOUBLE_CLICK_MS)
    }
  }
}
