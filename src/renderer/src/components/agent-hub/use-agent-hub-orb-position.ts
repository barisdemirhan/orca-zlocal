import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import { clampAgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import { useViewportSize } from './use-viewport-size'
import { claimAgentHubOrbGesture, releaseAgentHubOrbGesture } from './agent-hub-orb-gesture'
import { getDefaultFloatingTerminalTriggerPosition } from '../floating-terminal/trigger/floating-terminal-trigger-position'

const ORB_SIZE = { width: 48, height: 48 }
type Position = { x: number; y: number }
type Drag = {
  pointerId: number
  pointer: Position
  start: Position
  next: Position
  moved: boolean
  element: HTMLElement
}

function clamp(position: Position): Position {
  const geometry = clampAgentHubMirrorGeometry(
    { ...position, ...ORB_SIZE },
    { width: window.innerWidth, height: window.innerHeight },
    ORB_SIZE
  )
  const top = Math.min(
    WORKSPACE_TOP_CHROME_HEIGHT,
    Math.max(0, window.innerHeight - STATUS_BAR_RESERVE_HEIGHT - ORB_SIZE.height)
  )
  return { x: geometry.x, y: Math.max(top, geometry.y) }
}

export function useAgentHubOrbPosition() {
  const saved = useAppStore((s) => s.settings?.agentHubOrbPosition)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const viewport = useViewportSize()
  const [position, setPosition] = useState<Position>(() =>
    clamp(
      saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
        ? saved
        : {
            x: getDefaultFloatingTerminalTriggerPosition().left - ORB_SIZE.width - 12,
            y: window.innerHeight - 104
          }
    )
  )
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && !drag.current) {
      setPosition(clamp(saved))
    }
  }, [saved])

  useEffect(() => {
    setPosition((current) => clamp(current))
  }, [viewport.width, viewport.height])

  useEffect(() => {
    const release = (current: Drag): void => {
      if (current.element.hasPointerCapture(current.pointerId)) {
        current.element.releasePointerCapture(current.pointerId)
      }
    }
    const cancel = (): void => {
      const current = drag.current
      drag.current = null
      releaseAgentHubOrbGesture(drag)
      if (!current) {
        return
      }
      suppressClick.current = current.moved
      setPosition(clamp(current.start))
      release(current)
    }
    const move = (event: PointerEvent): void => {
      const current = drag.current
      if (!current || event.pointerId !== current.pointerId) {
        return
      }
      const dx = event.clientX - current.pointer.x
      const dy = event.clientY - current.pointer.y
      if (!current.moved && Math.hypot(dx, dy) < 3) {
        return
      }
      if (!current.moved) {
        current.element.setPointerCapture(current.pointerId)
      }
      current.moved = true
      current.next = clamp({ x: current.start.x + dx, y: current.start.y + dy })
      setPosition(current.next)
      event.preventDefault()
    }
    const end = (event: PointerEvent): void => {
      const current = drag.current
      if (!current || event.pointerId !== current.pointerId) {
        return
      }
      drag.current = null
      releaseAgentHubOrbGesture(drag)
      release(current)
      if (!current.moved) {
        return
      }
      suppressClick.current = true
      const next = clamp(current.next)
      setPosition(next)
      void updateSettings({ agentHubOrbPosition: next })
    }
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault()
        event.stopPropagation()
        cancel()
      }
    }
    const cancelPointer = (event: PointerEvent): void => {
      if (event.pointerId === drag.current?.pointerId) {
        cancel()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancelPointer)
    window.addEventListener('lostpointercapture', cancelPointer)
    window.addEventListener('blur', cancel)
    document.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancelPointer)
      window.removeEventListener('lostpointercapture', cancelPointer)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('keydown', key, true)
      if (drag.current) {
        release(drag.current)
      }
      drag.current = null
      releaseAgentHubOrbGesture(drag)
    }
  }, [updateSettings])

  return {
    position,
    onPointerDown: (event: React.PointerEvent<HTMLElement>): void => {
      if (event.button !== 0 || drag.current || !claimAgentHubOrbGesture(drag, event.pointerId)) {
        return
      }
      suppressClick.current = false
      drag.current = {
        pointerId: event.pointerId,
        pointer: { x: event.clientX, y: event.clientY },
        start: position,
        next: position,
        moved: false,
        element: event.currentTarget
      }
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>): void => {
      if (!suppressClick.current || event.detail === 0) {
        return
      }
      suppressClick.current = false
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
