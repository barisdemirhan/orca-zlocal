import { describe, expect, it } from 'vitest'
import {
  agentHubMirrorFocusGeometry,
  agentHubMirrorOpenGeometry,
  agentHubMirrorOpenRegion,
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorSize
} from './agent-hub-mirror-geometry'

// 1440x900 with a 280px left sidebar and a 350px right one.
const AREA = { left: 280, top: 36, width: 810, height: 840 }

describe('agent hub mirror geometry', () => {
  it('opens a mirror half the window wide, within its limits', () => {
    expect(defaultAgentHubMirrorSize({ width: 1440, height: 900 }).width).toBe(720)
    expect(defaultAgentHubMirrorSize({ width: 800, height: 600 }).width).toBe(560)
    expect(defaultAgentHubMirrorSize({ width: 3360, height: 1758 }).width).toBe(960)
  })

  it('centres a new mirror in the work area between the sidebars', () => {
    const geometry = agentHubMirrorOpenGeometry({ width: 600, height: 400 }, AREA, [])
    expect(geometry).toEqual({ x: 385, y: 256, width: 600, height: 400 })
  })

  it('steps each further mirror off the ones already open, inside the area', () => {
    const size = { width: 600, height: 400 }
    const taken: { x: number; y: number }[] = []
    for (let count = 0; count < 6; count += 1) {
      const next = agentHubMirrorOpenGeometry(size, AREA, taken)
      expect(taken).not.toContainEqual({ x: next.x, y: next.y })
      expect(next.x).toBeGreaterThanOrEqual(AREA.left)
      expect(next.y).toBeGreaterThanOrEqual(AREA.top)
      expect(next.x + next.width).toBeLessThanOrEqual(AREA.left + AREA.width)
      expect(next.y + next.height).toBeLessThanOrEqual(AREA.top + AREA.height)
      taken.push({ x: next.x, y: next.y })
    }
    expect(taken.slice(1, 3)).toEqual([
      { x: 413, y: 284 },
      { x: 441, y: 312 }
    ])
  })

  it('shrinks a mirror that is wider than the area rather than leaving it', () => {
    const geometry = agentHubMirrorOpenGeometry({ width: 960, height: 595 }, AREA, [])
    expect(geometry).toMatchObject({ x: 296, width: 778 })
  })

  it("opens beside the hub's open panel when a mirror fits there", () => {
    const wide = { left: 280, top: 36, width: 2730, height: 1698 }
    const panel = { left: 1529, top: 1356, width: 456, height: 325 }
    // Above the panel is the roomiest strip: the full width of the area.
    expect(agentHubMirrorOpenRegion(wide, panel)).toEqual({ ...wide, height: 1304 })
    // A panel that leaves no strip a mirror fits in is opened over.
    expect(agentHubMirrorOpenRegion(AREA, { left: 480, top: 200, width: 456, height: 676 })).toBe(
      AREA
    )
    expect(agentHubMirrorOpenRegion(AREA, null)).toBe(AREA)
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

  it('focuses a mirror centred in the work area, a margin clear on every side', () => {
    const viewport = { width: 1440, height: 900 }
    expect(agentHubMirrorFocusGeometry(AREA, viewport)).toEqual({
      x: 328,
      y: 84,
      width: 714,
      height: 744
    })
  })

  it('caps a focused mirror on a very large window, still centred', () => {
    const area = { left: 280, top: 36, width: 3080, height: 1698 }
    expect(agentHubMirrorFocusGeometry(area, { width: 3360, height: 1758 })).toEqual({
      x: 860,
      y: 285,
      width: 1920,
      height: 1200
    })
  })

  it("never focuses a mirror under a mirror's minimum size", () => {
    const area = { left: 0, top: 36, width: 400, height: 260 }
    expect(agentHubMirrorFocusGeometry(area, { width: 400, height: 320 })).toMatchObject({
      x: 0,
      width: 420,
      height: 240
    })
  })
})
