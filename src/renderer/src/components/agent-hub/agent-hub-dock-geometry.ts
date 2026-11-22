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

/** The dock's length along its edge: folded (`rest`) and as drawn now (`current`). */
export type AgentHubDockExtent = { rest: number; current: number }

/** Measured content includes the Orb slot and divider, even with every count at zero. */
export function agentHubDockMeasuredExtent(
  edge: AgentHubDockEdge,
  zoom: number,
  rest: { width: number; height: number } | null,
  current: { width: number; height: number } | null
): AgentHubDockExtent | null {
  if (!rest || !current) {
    return null
  }
  const horizontal = isHorizontalAgentHubDock(edge)
  return {
    rest: (horizontal ? rest.width : rest.height) * zoom,
    current: (horizontal ? current.width : current.height) * zoom
  }
}

/**
 * Fixed-position placement for the dock. The bottom and top docks overlap the status bar's and
 * the title bar's 1px divider, so the notch reads as part of that bar. Once measured, the dock
 * is pinned by its start (left, or top on a side edge) where the folded notch is centred, so it
 * unfolds one way and nothing already shown moves; near the far edge it is pulled back on screen.
 */
export function agentHubDockPlacement(
  position: AgentHubDockPosition,
  viewport: Viewport,
  chrome: { statusBarHeight: number; titleBarHeight: number },
  extent: AgentHubDockExtent | null = null
): { left?: number; right?: number; top?: number; bottom?: number; transform: string } {
  const horizontal = position.edge === 'bottom' || position.edge === 'top'
  const length = horizontal ? viewport.width : viewport.height
  const center =
    clamp(position.offset, horizontal ? BOTTOM_OFFSET_RANGE : SIDE_OFFSET_RANGE) * length
  const start = extent
    ? Math.round(
        Math.max(
          EDGE_MARGIN,
          Math.min(length - extent.current - EDGE_MARGIN, center - extent.rest / 2)
        )
      )
    : Math.round(center)
  // Before the first measure, centre on the offset.
  const along = extent ? 'none' : horizontal ? 'translateX(-50%)' : 'translateY(-50%)'
  switch (position.edge) {
    case 'bottom':
      return { left: start, bottom: chrome.statusBarHeight - 1, transform: along }
    case 'top':
      return { left: start, top: chrome.titleBarHeight - 1, transform: along }
    case 'right':
      return { right: 0, top: start, transform: along }
    case 'left':
      return { left: 0, top: start, transform: along }
  }
}

/** The folded bottom dock's box, so neighbours can keep clear of it; null on any other edge. */
export function agentHubDockBottomFootprint(
  position: AgentHubDockPosition,
  viewport: Viewport,
  chrome: { statusBarHeight: number; titleBarHeight: number },
  zoom: number,
  rest: { width: number; height: number } | null
): { left: number; right: number; top: number } | null {
  if (position.edge !== 'bottom' || !rest) {
    return null
  }
  const extent = { rest: rest.width * zoom, current: rest.width * zoom }
  const { left = 0, bottom = 0 } = agentHubDockPlacement(position, viewport, chrome, extent)
  return {
    left,
    right: left + extent.rest,
    top: Math.round(viewport.height - bottom - rest.height * zoom)
  }
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

/** Where a parked mirror's alert opens: away from a side dock, else toward the roomier half. */
export function agentHubTrayAlertSide(dock: AgentHubDockPosition | null): 'left' | 'right' {
  if (!dock) {
    // The status-bar trigger sits at the bar's right end.
    return 'left'
  }
  if (dock.edge === 'left' || dock.edge === 'right') {
    return dock.edge === 'left' ? 'right' : 'left'
  }
  return dock.offset > 0.5 ? 'left' : 'right'
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
