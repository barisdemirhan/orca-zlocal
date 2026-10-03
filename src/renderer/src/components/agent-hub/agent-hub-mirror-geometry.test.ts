import { describe, expect, it } from 'vitest'
import {
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'

describe('agent hub mirror geometry', () => {
  it('opens in the bottom-right corner, clear of the status bar', () => {
    const geometry = defaultAgentHubMirrorGeometry({ width: 1440, height: 900 })
    expect(geometry.x + geometry.width).toBeLessThan(1440)
    expect(geometry.y + geometry.height).toBeLessThanOrEqual(900 - 40)
  })

  it('pulls a window dragged off screen back inside the viewport', () => {
    expect(
      clampAgentHubMirrorGeometry(
        { x: 1300, y: -50, width: 640, height: 400 },
        { width: 1440, height: 900 }
      )
    ).toEqual({ x: 800, y: 0, width: 640, height: 400 })
  })

  it('keeps the size between the minimum and the viewport', () => {
    expect(
      clampAgentHubMirrorGeometry(
        { x: 0, y: 0, width: 100, height: 100 },
        { width: 1440, height: 900 }
      )
    ).toMatchObject({ width: 420, height: 240 })
    expect(
      clampAgentHubMirrorGeometry(
        { x: 0, y: 0, width: 5000, height: 5000 },
        { width: 1000, height: 700 }
      )
    ).toMatchObject({ width: 968, height: 644 })
  })

  it('stops a dragged window above the status bar', () => {
    const geometry = clampAgentHubMirrorGeometry(
      { x: 0, y: 800, width: 640, height: 300 },
      { width: 1440, height: 900 }
    )
    expect(geometry.y + geometry.height).toBe(900 - 24)
  })
})
