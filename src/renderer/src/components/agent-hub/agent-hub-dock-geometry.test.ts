import { describe, expect, it } from 'vitest'
import {
  agentHubNotchShape,
  agentHubDockDropPosition,
  agentHubDockPlacement,
  agentHubDockPopoverSide
} from './agent-hub-dock-geometry'

const viewport = { width: 1600, height: 1000 }
const chrome = { statusBarHeight: 24, titleBarHeight: 36 }

describe('agent hub dock geometry', () => {
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

  it('pulls an expanded dock near an edge fully on screen', () => {
    const narrow = { width: 1000, height: 800 }
    expect(agentHubDockPlacement({ edge: 'bottom', offset: 0.06 }, narrow, chrome, 300).left).toBe(
      158
    )
    expect(agentHubDockPlacement({ edge: 'bottom', offset: 0.94 }, narrow, chrome, 300).left).toBe(
      842
    )
    expect(agentHubDockPlacement({ edge: 'right', offset: 0.12 }, narrow, chrome, 260).top).toBe(
      138
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

  it('opens the popover away from the dock edge', () => {
    expect(agentHubDockPopoverSide('bottom')).toBe('top')
    expect(agentHubDockPopoverSide('right')).toBe('left')
    expect(agentHubDockPopoverSide('left')).toBe('right')
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
