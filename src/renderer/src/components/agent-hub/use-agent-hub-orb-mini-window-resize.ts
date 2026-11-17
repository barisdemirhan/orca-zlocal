import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { claimAgentHubOrbGesture, releaseAgentHubOrbGesture } from './agent-hub-orb-gesture'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'
import {
  AGENT_HUB_ORB_MINI_MAX_HEIGHT,
  AGENT_HUB_ORB_MINI_MAX_WIDTH,
  AGENT_HUB_ORB_MINI_MIN_HEIGHT,
  AGENT_HUB_ORB_MINI_MIN_WIDTH,
  type AgentHubOrbMiniSize,
  type AgentHubOrbMiniWindowFrame
} from './agent-hub-orb-mini-window-geometry'

export type AgentHubOrbMiniResizeEdge = 'right' | 'bottom' | 'corner'

type Resize = {
  pointerId: number
  pointer: { x: number; y: number }
  frame: AgentHubOrbMiniWindowFrame
  startSize: AgentHubOrbMiniSize | null
  startPosition: { x: number; y: number } | null
  edge: AgentHubOrbMiniResizeEdge
  stop: () => void
}

type ResizeHandlers = {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
}

function saveSize(size: AgentHubOrbMiniSize | null): void {
  void useAppStore.getState().updateSettings({ agentHubOrbMiniSize: size })
}

/** Edge and corner handles for the mini window; the top-left stays put and the size is saved when the gesture ends. */
export function useAgentHubOrbMiniWindowResize(frame: AgentHubOrbMiniWindowFrame): {
  handlers: (edge: AgentHubOrbMiniResizeEdge) => ResizeHandlers
  reset: () => void
} {
  const resize = useRef<Resize | null>(null)
  useEffect(() => () => resize.current?.stop(), [])

  const end = (cancelled: boolean): void => {
    const active = resize.current
    if (!active) {
      return
    }
    resize.current = null
    active.stop()
    releaseAgentHubOrbGesture(resize)
    if (cancelled) {
      useAgentHubOrbPanel.setState({
        miniSize: active.startSize,
        miniPosition: active.startPosition
      })
      return
    }
    saveSize(useAgentHubOrbPanel.getState().miniSize)
  }

  const handlers = (edge: AgentHubOrbMiniResizeEdge): ResizeHandlers => ({
    onPointerDown: (event) => {
      if (event.button !== 0 || !claimAgentHubOrbGesture(resize, event.pointerId)) {
        return
      }
      const onKeyDown = (key: KeyboardEvent): void => {
        if (key.key === 'Escape') {
          key.stopPropagation()
          end(true)
        }
      }
      window.addEventListener('keydown', onKeyDown, true)
      const panel = useAgentHubOrbPanel.getState()
      resize.current = {
        pointerId: event.pointerId,
        pointer: { x: event.clientX, y: event.clientY },
        frame,
        startSize: panel.miniSize,
        startPosition: panel.miniPosition,
        edge,
        stop: () => window.removeEventListener('keydown', onKeyDown, true)
      }
      useAgentHubOrbPanel.setState({ miniPosition: { x: frame.x, y: frame.y } })
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    onPointerMove: (event) => {
      const active = resize.current
      if (!active || active.pointerId !== event.pointerId) {
        return
      }
      const bounds = readAgentHubOrbBounds()
      const grows = (limit: number, min: number, max: number, start: number, delta: number) =>
        Math.round(Math.max(min, Math.min(max, limit, start + delta)))
      const width =
        active.edge === 'bottom'
          ? active.frame.width
          : grows(
              bounds.right - active.frame.x,
              AGENT_HUB_ORB_MINI_MIN_WIDTH,
              AGENT_HUB_ORB_MINI_MAX_WIDTH,
              active.frame.width,
              event.clientX - active.pointer.x
            )
      const height =
        active.edge === 'right'
          ? active.frame.height
          : grows(
              bounds.bottom - active.frame.y,
              AGENT_HUB_ORB_MINI_MIN_HEIGHT,
              AGENT_HUB_ORB_MINI_MAX_HEIGHT,
              active.frame.height,
              event.clientY - active.pointer.y
            )
      useAgentHubOrbPanel.setState({ miniSize: { width, height } })
      event.preventDefault()
    },
    onPointerUp: (event) => {
      if (resize.current?.pointerId === event.pointerId) {
        end(false)
      }
    },
    onPointerCancel: (event) => {
      if (resize.current?.pointerId === event.pointerId) {
        end(true)
      }
    }
  })

  const reset = (): void => {
    useAgentHubOrbPanel.setState({ miniSize: null })
    saveSize(null)
  }
  return { handlers, reset }
}
