import { describe, expect, it } from 'vitest'
import {
  agentHubDockDropPosition,
  agentHubDockPlacement,
  agentHubDockPopoverSide
} from './agent-hub-dock-geometry'

const viewport = { width: 1600, height: 1000 }

describe('agent hub dock geometry', () => {
  it('sits the bottom dock on the status bar, centred on its offset', () => {
    expect(agentHubDockPlacement({ edge: 'bottom', offset: 0.5 }, viewport, 24)).toEqual({
      left: 800,
      bottom: 24,
      transform: 'translateX(-50%)'
    })
  })

  it('keeps side docks clear of the title bar and status bar', () => {
    expect(agentHubDockPlacement({ edge: 'right', offset: 0 }, viewport, 24)).toEqual({
      right: 0,
      top: 120,
      transform: 'translateY(-50%)'
    })
    expect(agentHubDockPlacement({ edge: 'left', offset: 1 }, viewport, 24)).toMatchObject({
      left: 0,
      top: 880
    })
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
})
