import { describe, expect, it } from 'vitest'
import {
  agentHubNotchShape,
  agentHubDockDropPosition,
  agentHubDockPlacement,
  agentHubDockPopoverSide,
  agentHubDockMeasuredExtent
} from './agent-hub-dock-geometry'

const viewport = { width: 1600, height: 1000 }
const chrome = { statusBarHeight: 24, titleBarHeight: 36 }

describe('agent hub dock geometry', () => {
  it('includes the measured Orb slot in empty docks at every edge and zoom', () => {
    for (const edge of ['bottom', 'top', 'left', 'right'] as const) {
      const horizontal = edge === 'bottom' || edge === 'top'
      const rest = horizontal ? { width: 192, height: 28 } : { width: 28, height: 192 }
      const expanded = horizontal ? { width: 392, height: 28 } : { width: 28, height: 392 }
      expect(agentHubDockMeasuredExtent(edge, 1.25, rest, expanded)).toEqual({
        rest: 240,
        current: 490
      })
      expect(agentHubDockMeasuredExtent(edge, 1, null, expanded)).toBeNull()
    }
  })
  it('sits the bottom dock on the status bar, centred on its offset', () => {
    expect(agentHubDockPlacement({ edge: 'bottom', offset: 0.5 }, viewport, chrome)).toEqual({
      left: 800,
      bottom: 23,
      transform: 'translateX(-50%)'
    })
  })

  it('keeps side docks clear of the title bar and status bar', () => {
    expect(agentHubDockPlacement({ edge: 'right', offset: 0 }, viewport, chrome)).toEqual({
      right: 0,
      top: 120,
      transform: 'translateY(-50%)'
    })
    expect(agentHubDockPlacement({ edge: 'left', offset: 1 }, viewport, chrome)).toMatchObject({
      left: 0,
      top: 880
    })
  })

  it('hangs the top dock from the title bar, centred', () => {
    expect(agentHubDockPlacement({ edge: 'top', offset: 0.5 }, viewport, chrome)).toEqual({
      left: 800,
      top: 35,
      transform: 'translateX(-50%)'
    })
    expect(agentHubDockDropPosition({ x: 800, y: 12 }, viewport)).toEqual({
      edge: 'top',
      offset: 0.5
    })
    expect(agentHubDockPopoverSide('top')).toBe('bottom')
  })

  it('pins a measured dock by its start, so unfolding only grows it one way', () => {
    const bottom = { edge: 'bottom', offset: 0.5 } as const
    const folded = agentHubDockPlacement(bottom, viewport, chrome, { rest: 200, current: 200 })
    const unfolded = agentHubDockPlacement(bottom, viewport, chrome, { rest: 200, current: 420 })
    expect(folded).toEqual({ left: 700, bottom: 23, transform: 'none' })
    expect(unfolded.left).toBe(700)

    const right = { edge: 'right', offset: 0.5 } as const
    expect(agentHubDockPlacement(right, viewport, chrome, { rest: 120, current: 300 })).toEqual({
      right: 0,
      top: 440,
      transform: 'none'
    })
  })

  it('pulls an unfolded dock near the far edge back on screen', () => {
    const narrow = { width: 1000, height: 800 }
    const extent = { rest: 120, current: 300 }
    expect(
      agentHubDockPlacement({ edge: 'bottom', offset: 0.06 }, narrow, chrome, extent).left
    ).toBe(8)
    expect(
      agentHubDockPlacement({ edge: 'bottom', offset: 0.94 }, narrow, chrome, extent).left
    ).toBe(692)
    expect(agentHubDockPlacement({ edge: 'right', offset: 0.88 }, narrow, chrome, extent).top).toBe(
      492
    )
  })

  it('drops onto the nearest edge and remembers where along it', () => {
    expect(agentHubDockDropPosition({ x: 400, y: 980 }, viewport)).toEqual({
      edge: 'bottom',
      offset: 0.25
    })
    expect(agentHubDockDropPosition({ x: 1590, y: 500 }, viewport)).toEqual({
      edge: 'right',
      offset: 0.5
    })
    expect(agentHubDockDropPosition({ x: 5, y: 300 }, viewport)).toEqual({
      edge: 'left',
      offset: 0.3
    })
  })

  it('draws the notch from the bar edge, around the bar, and back with both fillets', () => {
    const bottom = agentHubNotchShape('bottom', { width: 100, height: 26 })
    expect(bottom).toMatchObject({ width: 120, height: 26, left: -10, top: 0 })
    expect(bottom.stroke.startsWith('M 0 26 A 10 10 0 0 0 10 16')).toBe(true)
    expect(bottom.stroke.endsWith('A 10 10 0 0 0 120 26')).toBe(true)
    expect(bottom.fill.endsWith('Z')).toBe(true)

    const right = agentHubNotchShape('right', { width: 26, height: 100 })
    expect(right).toMatchObject({ width: 26, height: 120, left: 0, top: -10 })
    expect(right.stroke.startsWith('M 26 0 A 10 10 0 0 1 16 10')).toBe(true)
  })
})
