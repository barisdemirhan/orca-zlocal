import { describe, expect, it } from 'vitest'
import {
  fitAgentHubOrb,
  layoutAgentHubOrb,
  placeAgentHubOrbRequest,
  type AgentHubOrbBounds
} from './agent-hub-orb-geometry'
import { agentHubOrbPillBelow } from './agent-hub-orb-overhang'

const bounds = { left: 12, top: 48, right: 788, bottom: 864 }

describe('Orb request placement', () => {
  it.each([
    { side: 'right', anchor: { x: 40, y: 160, width: 240, height: 220 } },
    { side: 'left', anchor: { x: 510, y: 100, width: 250, height: 330 } },
    { side: 'top', anchor: { x: 280, y: 610, width: 240, height: 200 } },
    { side: 'bottom', anchor: { x: 280, y: 60, width: 240, height: 200 } }
  ])(
    'uses the available $side space without covering the complete control shell',
    ({ side, anchor }) => {
      const area = side === 'right' || side === 'left' ? { ...bounds, bottom: 564 } : bounds
      const card = placeAgentHubOrbRequest({
        anchor,
        bounds: area,
        desiredSize: { width: 320, height: 240 }
      })
      expect(card?.side).toBe(side)
      expect(card).not.toBeNull()
      if (!card) {
        throw new Error('Expected adjacent request')
      }
      expect(card.x).toBeGreaterThanOrEqual(area.left)
      expect(card.y).toBeGreaterThanOrEqual(area.top)
      expect(card.x + card.width).toBeLessThanOrEqual(area.right)
      expect(card.y + card.height).toBeLessThanOrEqual(area.bottom)
      expect(
        card.x + card.width <= anchor.x - 14 ||
          card.x >= anchor.x + anchor.width + 14 ||
          card.y + card.height <= anchor.y - 14 ||
          card.y >= anchor.y + anchor.height + 14
      ).toBe(true)
    }
  )

  it('keeps the current side when equal fully fitting regions would otherwise alternate', () => {
    const card = placeAgentHubOrbRequest({
      bounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
      anchor: { x: 400, y: 400, width: 200, height: 200 },
      desiredSize: { width: 240, height: 240 },
      previousSide: 'bottom'
    })
    expect(card?.side).toBe('bottom')
  })

  it('uses the real remaining dimensions for a long body instead of clamping it onto Orb', () => {
    const card = placeAgentHubOrbRequest({
      bounds: { left: 0, top: 0, right: 800, bottom: 600 },
      anchor: { x: 300, y: 160, width: 200, height: 280 },
      desiredSize: { width: 320, height: 480 },
      previousSide: 'left'
    })
    expect(card).toMatchObject({ side: 'left', x: 0, width: 286, height: 480 })
  })
})

describe('Orb viewport fitting', () => {
  it('stacks a long request at 390×600 while retaining the large preferred diameter for a wider viewport', () => {
    const options = {
      position: { x: 144, y: 200 },
      preferredDiameter: 360,
      requestSize: { width: 320, height: 480 }
    }
    const narrow: AgentHubOrbBounds = { left: 12, top: 48, right: 378, bottom: 540 }
    const small = layoutAgentHubOrb({ ...options, bounds: narrow })
    expect(small.request?.placement).toBe('stack')
    expect(small.orb.diameter).toBeLessThan(128)
    expect(small.orb.minimum).toBeLessThanOrEqual(small.orb.maximum)
    expect(small.request?.x).toBe(small.orb.x)
    expect(small.request?.width).toBe(small.orb.width)
    expect(small.request?.y).toBeGreaterThanOrEqual(small.orb.y + small.orb.height + 14)
    expect((small.request?.y ?? 0) + (small.request?.height ?? 0)).toBeLessThanOrEqual(
      narrow.bottom
    )
    expect((small.request?.x ?? 0) + (small.request?.width ?? 0)).toBeLessThanOrEqual(narrow.right)
    const restored = layoutAgentHubOrb({
      ...options,
      bounds: { left: 12, top: 48, right: 1400, bottom: 1200 }
    })
    expect(restored.orb.diameter).toBe(360)
  })

  it('reserves measured controls and notices without moving the top-left resize anchor', () => {
    const orb = fitAgentHubOrb({
      position: { x: 80, y: 100 },
      preferredDiameter: 360,
      bounds: { left: 12, top: 48, right: 600, bottom: 600 },
      controlsWidth: 310,
      heightOverhead: 180
    })
    expect(orb).toMatchObject({
      x: 80,
      y: 100,
      diameter: 320,
      maximum: 320,
      width: 426,
      height: 500
    })
  })

  it('lets the transparent room around the sphere pass the top and bottom bounds', () => {
    const fit = (y: number) =>
      fitAgentHubOrb({
        position: { x: 80, y },
        preferredDiameter: 128,
        bounds,
        overhang: { top: 15, bottom: 113 }
      })
    expect(fit(0)).toMatchObject({ y: 33, diameter: 128 })
    // The lowest stage whose box passes the bottom bound by its room keeps its full size.
    expect(fit(864 + 113 - 128 - 116)).toMatchObject({ y: 733, diameter: 128 })
  })

  it('moves the hover pill under the sphere once it would pass the top bound', () => {
    const overhang = { top: 49, bottom: 0, pill: 42 }
    // The pill needs its height plus a 6px gap above the visible sphere.
    expect(agentHubOrbPillBelow(48 - 49 + 48, overhang, bounds)).toBe(false)
    expect(agentHubOrbPillBelow(48 - 49 + 47, overhang, bounds)).toBe(true)
  })
})
