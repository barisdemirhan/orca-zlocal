export type AgentHubMirrorGeometry = { x: number; y: number; width: number; height: number }

const MIN_WIDTH = 420
const MIN_HEIGHT = 240
const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 400
const EDGE_GAP = 16
// Keeps the default spot clear of the status bar.
const BOTTOM_RESERVE = 40

type Viewport = { width: number; height: number }

export function defaultAgentHubMirrorGeometry(viewport: Viewport): AgentHubMirrorGeometry {
  return {
    x: viewport.width - DEFAULT_WIDTH - EDGE_GAP,
    y: viewport.height - DEFAULT_HEIGHT - BOTTOM_RESERVE,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
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
