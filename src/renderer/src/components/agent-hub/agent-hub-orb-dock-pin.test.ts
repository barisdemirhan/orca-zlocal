import { describe, expect, it } from 'vitest'
import {
  AGENT_HUB_ORB_PINNED_DIAMETER,
  agentHubOrbDockDrop,
  agentHubOrbPinnedCentre,
  layoutAgentHubOrbPinned,
  type AgentHubOrbDockBox
} from './agent-hub-orb-dock-pin'
import { AGENT_HUB_ORB_VISIBLE_RADIUS } from './agent-hub-orb-geometry'

const radius = AGENT_HUB_ORB_PINNED_DIAMETER * AGENT_HUB_ORB_VISIBLE_RADIUS
const dock: AgentHubOrbDockBox = { left: 400, top: 850, right: 700, bottom: 886, edge: 'bottom' }

describe('Orb pinned beside the dock', () => {
  it('sits before the dock, bottom-aligned with it, and grows upward from there', () => {
    const centre = agentHubOrbPinnedCentre(dock)
    expect(centre.x + radius).toBeCloseTo(dock.left - 10)
    expect(centre.y + radius).toBeCloseTo(dock.bottom)

    const layout = layoutAgentHubOrbPinned(dock, 170, 116, 1000)
    expect(layout.x + layout.width / 2).toBeCloseTo(centre.x)
    expect(layout.bottom).not.toBeNull()
    expect(1000 - (layout.bottom ?? 0) - 12 - (layout.diameter + 52) / 2).toBeCloseTo(centre.y)
  })

  it('goes after a dock that leaves no room before it', () => {
    const centre = agentHubOrbPinnedCentre({ ...dock, left: 20, right: 320 })
    expect(centre.x - radius).toBeCloseTo(330)
  })

  it('shows the drop zone near the pinned spot and arms it close by', () => {
    const centre = agentHubOrbPinnedCentre(dock)
    expect(agentHubOrbDockDrop({ x: centre.x - 40, y: centre.y - 40 }, dock)).toBe('armed')
    expect(agentHubOrbDockDrop({ x: centre.x - 150, y: centre.y - 60 }, dock)).toBe('near')
    expect(agentHubOrbDockDrop({ x: centre.x - 400, y: centre.y }, dock)).toBe('none')
    expect(agentHubOrbDockDrop(centre, null)).toBe('none')
  })
})
