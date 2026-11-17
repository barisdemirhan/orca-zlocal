import type { AgentHubOrbBounds } from './agent-hub-orb-geometry'

export const AGENT_HUB_ORB_MINI_WIDTH = 340
export const AGENT_HUB_ORB_MINI_HEIGHT = 440

export const AGENT_HUB_ORB_MINI_MIN_WIDTH = 320
export const AGENT_HUB_ORB_MINI_MIN_HEIGHT = 380
export const AGENT_HUB_ORB_MINI_MAX_WIDTH = 560
export const AGENT_HUB_ORB_MINI_MAX_HEIGHT = 760

export type AgentHubOrbMiniSize = { width: number; height: number }

export type AgentHubOrbMiniWindowFrame = { x: number; y: number; width: number; height: number }

/** The window shrinks to the viewport first; the wanted corner (remembered, else the sphere's) then slides inside it. */
export function placeAgentHubOrbMiniWindow(
  wanted: { x: number; y: number } | null,
  bounds: AgentHubOrbBounds,
  size: AgentHubOrbMiniSize | null = null
): AgentHubOrbMiniWindowFrame {
  const wantedWidth = within(
    size?.width ?? AGENT_HUB_ORB_MINI_WIDTH,
    AGENT_HUB_ORB_MINI_MIN_WIDTH,
    AGENT_HUB_ORB_MINI_MAX_WIDTH
  )
  const wantedHeight = within(
    size?.height ?? AGENT_HUB_ORB_MINI_HEIGHT,
    AGENT_HUB_ORB_MINI_MIN_HEIGHT,
    AGENT_HUB_ORB_MINI_MAX_HEIGHT
  )
  const width = Math.max(0, Math.min(wantedWidth, bounds.right - bounds.left))
  const height = Math.max(0, Math.min(wantedHeight, bounds.bottom - bounds.top))
  const corner = wanted ?? {
    x: (bounds.left + bounds.right - width) / 2,
    y: (bounds.top + bounds.bottom - height) / 2
  }
  return {
    x: Math.max(bounds.left, Math.min(bounds.right - width, corner.x)),
    y: Math.max(bounds.top, Math.min(bounds.bottom - height, corner.y)),
    width,
    height
  }
}

function within(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min
}
