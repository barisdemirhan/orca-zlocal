import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import { readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { defaultAgentHubMirrorSize, type AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'

export function mirrorTabDetachGeometry(
  windowId: string,
  point: { x: number; y: number }
): AgentHubMirrorGeometry {
  const area = agentHubWorkArea()
  const original =
    readAgentHubMirrorOrigin(windowId) ??
    defaultAgentHubMirrorSize({ width: window.innerWidth, height: window.innerHeight })
  const width = Math.min(original.width, area.width)
  const height = Math.min(original.height, area.height)
  return {
    width,
    height,
    x: Math.min(Math.max(area.left, point.x), area.left + area.width - width),
    y: Math.min(Math.max(area.top, point.y), area.top + area.height - height)
  }
}
