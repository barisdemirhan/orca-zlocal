import { STATUS_BAR_RESERVE_HEIGHT } from '../sidebar/workspace-chrome-metrics'
import type { AgentHubRect } from './agent-hub-floating-arrange'

export type AgentHubMirrorGeometry = { x: number; y: number; width: number; height: number }

const MIN_WIDTH = 420
const MIN_HEIGHT = 240
const DEFAULT_MIN_WIDTH = 560
const DEFAULT_MAX_WIDTH = 960
const DEFAULT_ASPECT = 0.62
const EDGE_GAP = 16
// Each new mirror steps off the last so neither hides the other's header.
const CASCADE_STEP = 28
const CASCADE_SLOTS = 12
// Two windows this close (px) sit on the same spot.
const SAME_SPOT = 8
// A focused mirror keeps this much of the canvas (and its corner controls) clear around it.
const FOCUS_MARGIN = 48
const FOCUS_MAX_WIDTH = 1920
const FOCUS_MAX_HEIGHT = 1200

type Viewport = { width: number; height: number }
type Size = { width: number; height: number }

/** Half the window wide: the mirror scales the pane down, so width buys legibility. */
export function defaultAgentHubMirrorSize(viewport: Viewport): Size {
  const width = Math.min(
    DEFAULT_MAX_WIDTH,
    Math.max(DEFAULT_MIN_WIDTH, Math.round(viewport.width / 2))
  )
  return { width, height: Math.round(width * DEFAULT_ASPECT) }
}

/**
 * The part of the work area a new mirror opens in: all of it, or, while the hub's panel is open
 * over it (`avoid`), the roomiest strip beside, above or below the panel that still fits a mirror.
 */
export function agentHubMirrorOpenRegion(
  area: AgentHubRect,
  avoid: AgentHubRect | null
): AgentHubRect {
  if (!avoid) {
    return area
  }
  const right = area.left + area.width
  const bottom = area.top + area.height
  const avoidRight = Math.min(right, avoid.left + avoid.width)
  const avoidBottom = Math.min(bottom, avoid.top + avoid.height)
  const avoidLeft = Math.max(area.left, avoid.left)
  const avoidTop = Math.max(area.top, avoid.top)
  if (avoidLeft >= avoidRight || avoidTop >= avoidBottom) {
    return area
  }
  const strips: AgentHubRect[] = [
    { ...area, width: avoidLeft - EDGE_GAP - area.left },
    { ...area, left: avoidRight + EDGE_GAP, width: right - avoidRight - EDGE_GAP },
    { ...area, height: avoidTop - EDGE_GAP - area.top },
    { ...area, top: avoidBottom + EDGE_GAP, height: bottom - avoidBottom - EDGE_GAP }
  ]
  return strips
    .filter((strip) => strip.width >= MIN_WIDTH && strip.height >= MIN_HEIGHT)
    .reduce(
      (best, strip) =>
        best === area || strip.width * strip.height > best.width * best.height ? strip : best,
      area
    )
}

/**
 * Where a new mirror opens: centred in `region`, stepping diagonally off the windows already
 * there (`taken`, their top-left corners) and never leaving the region.
 */
export function agentHubMirrorOpenGeometry(
  size: Size,
  region: AgentHubRect,
  taken: readonly { x: number; y: number }[]
): AgentHubMirrorGeometry {
  const fit = (wanted: number, room: number, min: number): number =>
    Math.max(min, Math.min(wanted, room - EDGE_GAP * 2))
  const width = fit(size.width, region.width, MIN_WIDTH)
  const height = fit(size.height, region.height, MIN_HEIGHT)
  const within = (value: number, start: number, room: number): number =>
    Math.round(Math.min(Math.max(start, value), Math.max(start, start + room)))
  const place = (slot: number): AgentHubMirrorGeometry => ({
    x: within(
      region.left + (region.width - width) / 2 + slot * CASCADE_STEP,
      region.left,
      region.width - width
    ),
    y: within(
      region.top + (region.height - height) / 2 + slot * CASCADE_STEP,
      region.top,
      region.height - height
    ),
    width,
    height
  })
  // Down-right until the region's edge (steps past it land on a taken spot), then up-left.
  for (let index = 0; index <= CASCADE_SLOTS * 2; index += 1) {
    const candidate = place(index <= CASCADE_SLOTS ? index : CASCADE_SLOTS - index)
    const free = taken.every(
      (other) =>
        Math.abs(other.x - candidate.x) >= SAME_SPOT || Math.abs(other.y - candidate.y) >= SAME_SPOT
    )
    if (free) {
      return candidate
    }
  }
  return place(0)
}

/**
 * The box a focused mirror shows in: centred in the work area and filling it up to a margin,
 * capped so a very large window does not stretch the terminal past a comfortable read, and
 * never under the mirror's minimum size.
 */
export function agentHubMirrorFocusGeometry(
  area: AgentHubRect,
  viewport: Viewport
): AgentHubMirrorGeometry {
  const width = Math.max(MIN_WIDTH, Math.min(FOCUS_MAX_WIDTH, area.width - FOCUS_MARGIN * 2))
  const height = Math.max(MIN_HEIGHT, Math.min(FOCUS_MAX_HEIGHT, area.height - FOCUS_MARGIN * 2))
  return clampAgentHubMirrorGeometry(
    {
      x: Math.round(area.left + (area.width - width) / 2),
      y: Math.round(area.top + (area.height - height) / 2),
      width,
      height
    },
    viewport
  )
}

/** Fit the window inside the viewport: shrink first, then pull it back on screen. */
export function clampAgentHubMirrorGeometry(
  geometry: AgentHubMirrorGeometry,
  viewport: Viewport
): AgentHubMirrorGeometry {
  // Why the reserve: a mirror dragged down must not cover the status bar's controls.
  const usableHeight = viewport.height - STATUS_BAR_RESERVE_HEIGHT
  const maxWidth = Math.max(MIN_WIDTH, viewport.width - EDGE_GAP * 2)
  const maxHeight = Math.max(MIN_HEIGHT, usableHeight - EDGE_GAP * 2)
  const width = Math.min(maxWidth, Math.max(MIN_WIDTH, geometry.width))
  const height = Math.min(maxHeight, Math.max(MIN_HEIGHT, geometry.height))
  return {
    x: Math.min(Math.max(0, geometry.x), Math.max(0, viewport.width - width)),
    y: Math.min(Math.max(0, geometry.y), Math.max(0, usableHeight - height)),
    width,
    height
  }
}
