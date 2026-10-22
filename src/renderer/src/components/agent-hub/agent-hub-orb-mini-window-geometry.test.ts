import { describe, expect, it } from 'vitest'
import {
  AGENT_HUB_ORB_MINI_HEIGHT,
  AGENT_HUB_ORB_MINI_WIDTH,
  placeAgentHubOrbMiniWindow
} from './agent-hub-orb-mini-window-geometry'

const bounds = { left: 12, top: 48, right: 1012, bottom: 748 }

describe('placeAgentHubOrbMiniWindow', () => {
  it('opens at the wanted corner and slides back inside the viewport', () => {
    expect(placeAgentHubOrbMiniWindow({ x: 200, y: 100 }, bounds)).toEqual({
      x: 200,
      y: 100,
      width: AGENT_HUB_ORB_MINI_WIDTH,
      height: AGENT_HUB_ORB_MINI_HEIGHT
    })
    expect(placeAgentHubOrbMiniWindow({ x: 900, y: 700 }, bounds)).toMatchObject({
      x: 1012 - AGENT_HUB_ORB_MINI_WIDTH,
      y: 748 - AGENT_HUB_ORB_MINI_HEIGHT
    })
    expect(placeAgentHubOrbMiniWindow({ x: -40, y: 0 }, bounds)).toMatchObject({ x: 12, y: 48 })
  })

  it('centres without a wanted corner and shrinks to a small viewport', () => {
    expect(placeAgentHubOrbMiniWindow(null, bounds)).toMatchObject({ x: 342, y: 178 })
    expect(
      placeAgentHubOrbMiniWindow({ x: 0, y: 0 }, { ...bounds, right: 300, bottom: 400 })
    ).toEqual({ x: 12, y: 48, width: 288, height: 352 })
  })
})
