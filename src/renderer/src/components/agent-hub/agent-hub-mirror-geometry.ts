export type AgentHubMirrorGeometry = { x: number; y: number; width: number; height: number }

const MIN_WIDTH = 420
const MIN_HEIGHT = 240
const DEFAULT_MIN_WIDTH = 560
const DEFAULT_MAX_WIDTH = 960
const DEFAULT_ASPECT = 0.62
const EDGE_GAP = 16
// Keeps the default spot clear of the status bar.
const BOTTOM_RESERVE = 40

type Viewport = { width: number; height: number }

/** Bottom-right, half the window wide: the mirror scales the pane down, so width buys legibility. */
export function defaultAgentHubMirrorGeometry(viewport: Viewport): AgentHubMirrorGeometry {
  const width = Math.min(
    DEFAULT_MAX_WIDTH,
    Math.max(DEFAULT_MIN_WIDTH, Math.round(viewport.width / 2))
  )
  const height = Math.round(width * DEFAULT_ASPECT)
  return {
    x: viewport.width - width - EDGE_GAP,
    y: viewport.height - height - BOTTOM_RESERVE,
    width,
    height
  }
}

/** Fit the window inside the viewport: shrink first, then pull it back on screen. */
export function clampAgentHubMirrorGeometry(
  geometry: AgentHubMirrorGeometry,
  viewport: Viewport
): AgentHubMirrorGeometry {
  const maxWidth = Math.max(MIN_WIDTH, viewport.width - EDGE_GAP * 2)
  const maxHeight = Math.max(MIN_HEIGHT, viewport.height - EDGE_GAP * 2)
  const width = Math.min(maxWidth, Math.max(MIN_WIDTH, geometry.width))
  const height = Math.min(maxHeight, Math.max(MIN_HEIGHT, geometry.height))
  return {
    x: Math.min(Math.max(0, geometry.x), Math.max(0, viewport.width - width)),
    y: Math.min(Math.max(0, geometry.y), Math.max(0, viewport.height - height)),
    width,
    height
  }
}
