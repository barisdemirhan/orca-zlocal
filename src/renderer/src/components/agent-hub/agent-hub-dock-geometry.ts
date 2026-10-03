import type { AgentHubDockEdge, AgentHubDockPosition } from '../../../../shared/agent-hub-settings'

type Point = { x: number; y: number }
type Viewport = { width: number; height: number }

// Side docks keep clear of the title bar and status bar; the bottom dock clear of the corners.
const SIDE_OFFSET_RANGE = [0.12, 0.88] as const
const BOTTOM_OFFSET_RANGE = [0.06, 0.94] as const

function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, value))
}

/** Fixed-position placement for the dock; the bottom dock sits on the status bar's top edge. */
export function agentHubDockPlacement(
  position: AgentHubDockPosition,
  viewport: Viewport,
  statusBarHeight: number
): { left?: number; right?: number; top?: number; bottom?: number; transform: string } {
  if (position.edge === 'bottom') {
    return {
      left: Math.round(clamp(position.offset, BOTTOM_OFFSET_RANGE) * viewport.width),
      bottom: statusBarHeight,
      transform: 'translateX(-50%)'
    }
  }
  const top = Math.round(clamp(position.offset, SIDE_OFFSET_RANGE) * viewport.height)
  return position.edge === 'right'
    ? { right: 0, top, transform: 'translateY(-50%)' }
    : { left: 0, top, transform: 'translateY(-50%)' }
}

/** Where a dropped dock lands: the nearest of the bottom, left and right edges. */
export function agentHubDockDropPosition(point: Point, viewport: Viewport): AgentHubDockPosition {
  const distances: [AgentHubDockEdge, number][] = [
    ['bottom', viewport.height - point.y],
    ['right', viewport.width - point.x],
    ['left', point.x]
  ]
  const [edge] = distances.reduce((best, next) => (next[1] < best[1] ? next : best))
  return edge === 'bottom'
    ? { edge, offset: clamp(point.x / viewport.width, BOTTOM_OFFSET_RANGE) }
    : { edge, offset: clamp(point.y / viewport.height, SIDE_OFFSET_RANGE) }
}

/** The popover opens away from the edge the dock is on. */
export function agentHubDockPopoverSide(edge: AgentHubDockEdge): 'top' | 'left' | 'right' {
  return edge === 'bottom' ? 'top' : edge === 'right' ? 'left' : 'right'
}
