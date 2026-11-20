import { useEffect, useRef, useState } from 'react'
import {
  agentHubOrbResizeKeyDiameter,
  clampAgentHubOrbDiameter,
  type AgentHubOrbGeometry,
  type AgentHubOrbOverhang
} from './agent-hub-orb-geometry'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { clampAgentHubOrbPosition } from './agent-hub-orb-overhang'
import { claimAgentHubOrbGesture, releaseAgentHubOrbGesture } from './agent-hub-orb-gesture'
import {
  agentHubOrbDockDrop,
  agentHubOrbPinnedCentre,
  agentHubOrbSphereCentre,
  readAgentHubOrbDockBox,
  setAgentHubOrbPinned,
  type AgentHubOrbDockDrop
} from './agent-hub-orb-dock-pin'

/** A pinned sphere has to travel this far before it leaves the dock, so a click is not a drag. */
const UNPIN_DISTANCE = 24

type OrbGesture = {
  mode: 'move' | 'resize'
  pointerId: number
  element: HTMLElement
  pointer: { x: number; y: number }
  position: { x: number; y: number }
  /** Where the floating sphere was before the gesture; a cancel or a pin puts it back. */
  start: { x: number; y: number }
  startPinned: boolean
  pinned: boolean
  drop: AgentHubOrbDockDrop
  preferredDiameter: number
  diameter: number
  width: number
  height: number
  overhang: AgentHubOrbOverhang
}

export function useAgentHubOrbDrag({
  embedded,
  compact,
  pinned,
  geometry,
  overhang,
  preferredDiameter,
  rememberDiameter
}: {
  embedded: boolean
  compact: boolean
  pinned: boolean
  geometry: AgentHubOrbGeometry
  overhang: AgentHubOrbOverhang
  preferredDiameter: number
  rememberDiameter: (diameter: number) => void
}) {
  const gesture = useRef<OrbGesture | null>(null)
  /** The drop zone beside the dock while a drag is near it, with the pinned sphere's centre. */
  const [dockDrop, setDockDrop] = useState<{
    drop: Exclude<AgentHubOrbDockDrop, 'none'>
    centre: { x: number; y: number }
  } | null>(null)

  useEffect(() => {
    const finish = (cancel: boolean): void => {
      const active = gesture.current
      gesture.current = null
      releaseAgentHubOrbGesture(gesture)
      if (!active) {
        return
      }
      setDockDrop(null)
      if (cancel) {
        useAgentHubOrbPanel.setState({
          stagePosition: active.start,
          ...(active.mode === 'resize' ? { preferredDiameter: active.preferredDiameter } : {})
        })
        if (active.startPinned !== active.pinned) {
          setAgentHubOrbPinned(active.startPinned)
        }
      } else if (active.mode === 'resize') {
        const diameter = useAgentHubOrbPanel.getState().preferredDiameter
        if (diameter !== active.preferredDiameter) {
          rememberDiameter(diameter)
        }
      } else if (active.drop === 'armed') {
        useAgentHubOrbPanel.setState({ stagePosition: active.start })
        setAgentHubOrbPinned(true)
      }
      if (active.element.hasPointerCapture(active.pointerId)) {
        active.element.releasePointerCapture(active.pointerId)
      }
    }
    const unpin = (active: OrbGesture, event: PointerEvent): void => {
      const diameter = active.preferredDiameter
      active.pinned = false
      active.diameter = diameter
      active.width = diameter + 106
      active.height = diameter + 116
      // Why: the sphere grows back to its floating size under the pointer instead of jumping to its old spot.
      active.position = {
        x: event.clientX - active.width / 2,
        y: event.clientY - (diameter + 52) / 2
      }
      active.pointer = { x: event.clientX, y: event.clientY }
      useAgentHubOrbPanel.setState({ stagePosition: active.position })
      setAgentHubOrbPinned(false)
    }
    const move = (event: PointerEvent): void => {
      const active = gesture.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }
      const dx = event.clientX - active.pointer.x
      const dy = event.clientY - active.pointer.y
      event.preventDefault()
      if (active.mode === 'resize') {
        useAgentHubOrbPanel.setState({
          preferredDiameter: clampAgentHubOrbDiameter(active.diameter + Math.max(dx, dy))
        })
        return
      }
      if (active.pinned) {
        if (Math.hypot(dx, dy) >= UNPIN_DISTANCE) {
          unpin(active, event)
        }
        return
      }
      const position = clampAgentHubOrbPosition(
        { x: active.position.x + dx, y: active.position.y + dy },
        active,
        readAgentHubOrbBounds(),
        active.overhang
      )
      useAgentHubOrbPanel.setState({ stagePosition: position })
      const dock = readAgentHubOrbDockBox()
      const drop = agentHubOrbDockDrop(agentHubOrbSphereCentre(position, active), dock)
      if (drop !== active.drop) {
        active.drop = drop
        setDockDrop(
          dock && drop !== 'none' ? { drop, centre: agentHubOrbPinnedCentre(dock) } : null
        )
      }
    }
    const end = (event: PointerEvent): void => {
      if (event.pointerId === gesture.current?.pointerId) {
        finish(event.type !== 'pointerup')
      }
    }
    const cancel = (): void => finish(true)
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
        cancel()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('lostpointercapture', end)
    window.addEventListener('blur', cancel)
    document.addEventListener('keydown', escape, true)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('lostpointercapture', end)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('keydown', escape, true)
      cancel()
    }
  }, [embedded, compact, rememberDiameter])

  return {
    dockDrop,
    beginGesture: (mode: OrbGesture['mode'], event: React.PointerEvent<HTMLElement>): void => {
      if (
        event.button !== 0 ||
        gesture.current ||
        embedded ||
        ((compact || pinned) && mode === 'resize') ||
        !claimAgentHubOrbGesture(gesture, event.pointerId)
      ) {
        return
      }
      event.stopPropagation()
      event.preventDefault()
      const position = { x: geometry.x, y: geometry.y }
      gesture.current = {
        mode,
        pointerId: event.pointerId,
        element: event.currentTarget,
        pointer: { x: event.clientX, y: event.clientY },
        position,
        start: pinned ? (useAgentHubOrbPanel.getState().stagePosition ?? position) : position,
        startPinned: pinned,
        pinned,
        drop: 'none',
        preferredDiameter,
        diameter: geometry.diameter,
        width: geometry.width,
        height: geometry.height,
        overhang
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    resizeKey: (event: React.KeyboardEvent<HTMLElement>): void => {
      if (embedded || compact || pinned || gesture.current) {
        return
      }
      const diameter = agentHubOrbResizeKeyDiameter(event.key, event.shiftKey, geometry)
      if (diameter === null) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      useAgentHubOrbPanel.setState({ preferredDiameter: diameter })
      rememberDiameter(diameter)
    }
  }
}
