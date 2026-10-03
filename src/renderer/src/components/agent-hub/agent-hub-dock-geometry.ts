import type { AgentHubDockEdge, AgentHubDockPosition } from '../../../../shared/agent-hub-settings'

type Point = { x: number; y: number }
type Viewport = { width: number; height: number }

// Side docks keep clear of the title bar and status bar; top and bottom docks clear of the corners.
const SIDE_OFFSET_RANGE = [0.12, 0.88] as const
const BOTTOM_OFFSET_RANGE = [0.06, 0.94] as const

const EDGE_MARGIN = 8

function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, value))
}

/** Pulls a centered dock of this extent fully on screen; the saved offset stays as it was. */
function keepInside(center: number, extent: number, length: number): number {
  const half = extent / 2 + EDGE_MARGIN
  return half * 2 >= length ? length / 2 : Math.min(length - half, Math.max(half, center))
}

/**
 * Fixed-position placement for the dock. The bottom and top docks overlap the status bar's and
 * the title bar's 1px divider, so the notch reads as part of that bar.
 */
export function agentHubDockPlacement(
  position: AgentHubDockPosition,
  viewport: Viewport,
  chrome: { statusBarHeight: number; titleBarHeight: number },
  /** The dock's current length along its edge (it grows when expanded). */
  extent = 0
): { left?: number; right?: number; top?: number; bottom?: number; transform: string } {
  if (position.edge === 'bottom' || position.edge === 'top') {
    const center = clamp(position.offset, BOTTOM_OFFSET_RANGE) * viewport.width
    const left = Math.round(keepInside(center, extent, viewport.width))
    return position.edge === 'bottom'
      ? { left, bottom: chrome.statusBarHeight - 1, transform: 'translateX(-50%)' }
      : { left, top: chrome.titleBarHeight - 1, transform: 'translateX(-50%)' }
  }
  const center = clamp(position.offset, SIDE_OFFSET_RANGE) * viewport.height
  const top = Math.round(keepInside(center, extent, viewport.height))
  return position.edge === 'right'
    ? { right: 0, top, transform: 'translateY(-50%)' }
    : { left: 0, top, transform: 'translateY(-50%)' }
}

/** Where a dropped dock lands: the nearest window edge. */
export function agentHubDockDropPosition(point: Point, viewport: Viewport): AgentHubDockPosition {
  const distances: [AgentHubDockEdge, number][] = [
    ['bottom', viewport.height - point.y],
    ['top', point.y],
    ['right', viewport.width - point.x],
    ['left', point.x]
  ]
  const [edge] = distances.reduce((best, next) => (next[1] < best[1] ? next : best))
  return edge === 'bottom' || edge === 'top'
    ? { edge, offset: clamp(point.x / viewport.width, BOTTOM_OFFSET_RANGE) }
    : { edge, offset: clamp(point.y / viewport.height, SIDE_OFFSET_RANGE) }
}

/** The popover and alerts open away from the edge the dock is on. */
export function agentHubDockPopoverSide(
  edge: AgentHubDockEdge
): 'top' | 'bottom' | 'left' | 'right' {
  switch (edge) {
    case 'bottom':
      return 'top'
    case 'top':
      return 'bottom'
    case 'right':
      return 'left'
    case 'left':
      return 'right'
  }
}

/** True for the docks that run along a horizontal bar. */
export function isHorizontalAgentHubDock(edge: AgentHubDockEdge): boolean {
  return edge === 'bottom' || edge === 'top'
}

const FILLET_RADIUS = 10
const CORNER_RADIUS = 14

export type AgentHubNotchShape = {
  /** Closed outline for the fill: the notch plus its two fillets, open along the attached edge. */
  fill: string
  /** The same outline without the attached edge, for the hairline. */
  stroke: string
  width: number
  height: number
  /** Offset from the bar's box: the fillets reach past both ends of the bar. */
  left: number
  top: number
}

/**
 * The dock's outline as SVG paths, so the hairline runs unbroken from the status bar (or the
 * title bar, or the window edge) around the notch and back. Built along the edge in (u, v) —
 * u along the edge, v away from it — then mapped onto the edge the dock sits on.
 */
export function agentHubNotchShape(
  edge: AgentHubDockEdge,
  bar: { width: number; height: number }
): AgentHubNotchShape {
  const horizontal = isHorizontalAgentHubDock(edge)
  const thickness = horizontal ? bar.height : bar.width
  const length = (horizontal ? bar.width : bar.height) + FILLET_RADIUS * 2
  const r = FILLET_RADIUS
  const radius = Math.min(CORNER_RADIUS, thickness - r)
  // A reflection flips which way each arc turns.
  const mirrored = edge === 'bottom' || edge === 'left'
  const point = (u: number, v: number): string => {
    switch (edge) {
      case 'top':
        return `${u} ${v}`
      case 'bottom':
        return `${u} ${thickness - v}`
      case 'left':
        return `${v} ${u}`
      case 'right':
        return `${thickness - v} ${u}`
    }
  }
  const arc = (size: number, sweep: 0 | 1, u: number, v: number): string =>
    `A ${size} ${size} 0 0 ${mirrored ? 1 - sweep : sweep} ${point(u, v)}`
  const stroke = [
    `M ${point(0, 0)}`,
    arc(r, 1, r, r),
    `L ${point(r, thickness - radius)}`,
    arc(radius, 0, r + radius, thickness),
    `L ${point(length - r - radius, thickness)}`,
    arc(radius, 0, length - r, thickness - radius),
    `L ${point(length - r, r)}`,
    arc(r, 1, length, 0)
  ].join(' ')
  return {
    fill: `${stroke} Z`,
    stroke,
    width: horizontal ? length : thickness,
    height: horizontal ? thickness : length,
    left: horizontal ? -r : 0,
    top: horizontal ? 0 : -r
  }
}
