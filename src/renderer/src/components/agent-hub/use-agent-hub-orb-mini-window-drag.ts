import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { claimAgentHubOrbGesture, releaseAgentHubOrbGesture } from './agent-hub-orb-gesture'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'
import {
  placeAgentHubOrbMiniWindow,
  type AgentHubOrbMiniWindowFrame
} from './agent-hub-orb-mini-window-geometry'

type Drag = {
  pointerId: number
  pointer: { x: number; y: number }
  origin: { x: number; y: number }
}

/** Where the mini window sits and how its header moves it; the corner it lands on is remembered. */
export function useAgentHubOrbMiniWindowDrag(): {
  frame: AgentHubOrbMiniWindowFrame
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
} {
  const wanted = useAgentHubOrbPanel((s) => s.miniPosition ?? s.stagePosition)
  const size = useAgentHubOrbPanel((s) => s.miniSize)
  const savedSize = useAppStore((s) => s.settings?.agentHubOrbMiniSize)
  const restored = useRef(false)
  useLayoutEffect(() => {
    if (restored.current || !savedSize) {
      return
    }
    restored.current = true
    if (useAgentHubOrbPanel.getState().miniSize === null) {
      useAgentHubOrbPanel.setState({ miniSize: savedSize })
    }
  }, [savedSize])
  const [bounds, setBounds] = useState(readAgentHubOrbBounds)
  const drag = useRef<Drag | null>(null)
  useEffect(() => {
    const measure = (): void => setBounds(readAgentHubOrbBounds())
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const frame = placeAgentHubOrbMiniWindow(wanted, bounds, size)
  const finish = (event: React.PointerEvent<HTMLElement>): void => {
    if (drag.current?.pointerId !== event.pointerId) {
      return
    }
    drag.current = null
    releaseAgentHubOrbGesture(drag)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  return {
    frame,
    onPointerDown: (event) => {
      const onControl =
        event.target instanceof Element && event.target.closest('button, a, input') !== null
      if (event.button !== 0 || onControl || !claimAgentHubOrbGesture(drag, event.pointerId)) {
        return
      }
      drag.current = {
        pointerId: event.pointerId,
        pointer: { x: event.clientX, y: event.clientY },
        origin: { x: frame.x, y: frame.y }
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    onPointerMove: (event) => {
      const active = drag.current
      if (!active || active.pointerId !== event.pointerId) {
        return
      }
      const moved = placeAgentHubOrbMiniWindow(
        {
          x: active.origin.x + event.clientX - active.pointer.x,
          y: active.origin.y + event.clientY - active.pointer.y
        },
        readAgentHubOrbBounds(),
        useAgentHubOrbPanel.getState().miniSize
      )
      useAgentHubOrbPanel.setState({ miniPosition: { x: moved.x, y: moved.y } })
      event.preventDefault()
    },
    onPointerUp: finish,
    onPointerCancel: finish
  }
}
