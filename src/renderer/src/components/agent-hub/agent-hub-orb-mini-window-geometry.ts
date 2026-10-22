import type { AgentHubOrbBounds } from './agent-hub-orb-geometry'

export const AGENT_HUB_ORB_MINI_WIDTH = 340
export const AGENT_HUB_ORB_MINI_HEIGHT = 440

export type AgentHubOrbMiniWindowFrame = { x: number; y: number; width: number; height: number }

/** The window shrinks to the viewport first; the wanted corner (remembered, else the sphere's) then slides inside it. */
export function placeAgentHubOrbMiniWindow(
  wanted: { x: number; y: number } | null,
  bounds: AgentHubOrbBounds
): AgentHubOrbMiniWindowFrame {
  const width = Math.max(0, Math.min(AGENT_HUB_ORB_MINI_WIDTH, bounds.right - bounds.left))
  const height = Math.max(0, Math.min(AGENT_HUB_ORB_MINI_HEIGHT, bounds.bottom - bounds.top))
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
