import { useLayoutEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { AGENT_HUB_ORB_VISIBLE_RADIUS, type AgentHubOrbGeometry } from './agent-hub-orb-geometry'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export const AGENT_HUB_ORB_PINNED_DIAMETER = 72
/** The art box is the canvas plus 52px; the canvas sits in its middle. */
const ART_EXTRA_HEIGHT = 52
const STAGE_BOTTOM_PADDING = 12
const DOCK_GAP = 10
const DROP_SHOWN = 240
const DROP_ARMED = 96

export type AgentHubOrbDockBox = {
  left: number
  top: number
  right: number
  bottom: number
  edge: 'top' | 'bottom' | 'left' | 'right'
}
export type AgentHubOrbDockDrop = 'none' | 'near' | 'armed'
export type AgentHubOrbPinnedGeometry = AgentHubOrbGeometry & {
  /** The visible sphere's centre. */
  centre: { x: number; y: number }
  /** Set when the stage grows upward from the dock: its CSS bottom keeps the sphere still. */
  bottom: number | null
  /** Beside a top or bottom dock, the side away from it, where the writing box and reply go. */
  away: 'left' | 'right' | null
}

export function readAgentHubOrbDockBox(): AgentHubOrbDockBox | null {
  const dock = document.querySelector<HTMLElement>('[data-agent-hub-dock]')
  const box = dock?.getBoundingClientRect()
  if (!dock || !box || box.width === 0 || box.height === 0) {
    return null
  }
  const edge = dock.dataset.edge
  return {
    left: Math.round(box.left),
    top: Math.round(box.top),
    right: Math.round(box.right),
    bottom: Math.round(box.bottom),
    edge: edge === 'top' || edge === 'left' || edge === 'right' ? edge : 'bottom'
  }
}

/** Where the pinned sphere's centre sits: before the dock along its row, flush with its screen-edge side. */
export function agentHubOrbPinnedCentre(dock: AgentHubOrbDockBox): { x: number; y: number } {
  const radius = AGENT_HUB_ORB_PINNED_DIAMETER * AGENT_HUB_ORB_VISIBLE_RADIUS
  if (dock.edge === 'left' || dock.edge === 'right') {
    return {
      x: dock.edge === 'left' ? dock.left + radius : dock.right - radius,
      y: dock.top - DOCK_GAP - radius
    }
  }
  // Why: a dock pushed against the left edge leaves no room before it, so the sphere goes after it.
  const before = dock.left - DOCK_GAP - radius
  return {
    x: before - radius < 4 ? dock.right + DOCK_GAP + radius : before,
    y: dock.edge === 'top' ? dock.top + radius : dock.bottom - radius
  }
}

export function layoutAgentHubOrbPinned(
  dock: AgentHubOrbDockBox,
  controlsWidth: number,
  heightOverhead: number,
  viewportHeight: number
): AgentHubOrbPinnedGeometry {
  const diameter = AGENT_HUB_ORB_PINNED_DIAMETER
  const centre = agentHubOrbPinnedCentre(dock)
  const width = Math.max(diameter + 106, controlsWidth + 24)
  const height = diameter + heightOverhead
  const artHalf = (diameter + ART_EXTRA_HEIGHT) / 2
  const opensUp = dock.edge !== 'top'
  const artBottom = centre.y + artHalf + STAGE_BOTTOM_PADDING
  return {
    x: centre.x - width / 2,
    y: opensUp ? artBottom - height : centre.y - artHalf,
    width,
    height,
    diameter,
    minimum: diameter,
    maximum: diameter,
    centre,
    bottom: opensUp ? viewportHeight - artBottom : null,
    away:
      dock.edge === 'left' || dock.edge === 'right' ? null : centre.x < dock.left ? 'left' : 'right'
  }
}

/** Whether the writing box fits in the dock's row, on the sphere's side away from the dock. */
export function agentHubOrbPinnedQuickFits(
  layout: AgentHubOrbPinnedGeometry,
  boxWidth: number,
  bounds: { left: number; right: number }
): boolean {
  const reach = layout.diameter * AGENT_HUB_ORB_VISIBLE_RADIUS + DOCK_GAP + boxWidth
  return layout.away === 'left'
    ? layout.centre.x - reach >= bounds.left
    : layout.away === 'right' && layout.centre.x + reach <= bounds.right
}

/** How close a dragged sphere's centre is to the pinned spot: the drop zone shows when near, a release pins when armed. */
export function agentHubOrbDockDrop(
  sphere: { x: number; y: number },
  dock: AgentHubOrbDockBox | null
): AgentHubOrbDockDrop {
  if (!dock) {
    return 'none'
  }
  const centre = agentHubOrbPinnedCentre(dock)
  const distance = Math.hypot(sphere.x - centre.x, sphere.y - centre.y)
  return distance < DROP_ARMED ? 'armed' : distance < DROP_SHOWN ? 'near' : 'none'
}

/** The visible sphere's centre for a stage box at a given position. */
export function agentHubOrbSphereCentre(
  position: { x: number; y: number },
  size: { width: number; diameter: number }
): { x: number; y: number } {
  return {
    x: position.x + size.width / 2,
    y: position.y + (size.diameter + ART_EXTRA_HEIGHT) / 2
  }
}

export function setAgentHubOrbPinned(pinned: boolean): void {
  useAgentHubOrbPanel.setState({ pinned })
  void useAppStore.getState().updateSettings({ agentHubOrbPinned: pinned })
}

/** Restores the pin from settings once, the way the diameter is restored. */
export function useAgentHubOrbPinned(): boolean {
  const pinned = useAgentHubOrbPanel((state) => state.pinned)
  const saved = useAppStore((state) => state.settings?.agentHubOrbPinned)
  const restored = useRef(false)
  useLayoutEffect(() => {
    if (restored.current || saved === undefined) {
      return
    }
    restored.current = true
    useAgentHubOrbPanel.setState({ pinned: saved })
  }, [saved])
  return pinned
}
