import { describe, expect, it } from 'vitest'
import { arrangeAgentHubFloatingWindows } from './agent-hub-floating-arrange'

const area = { left: 240, top: 36, width: 1600, height: 960 }

describe('arrangeAgentHubFloatingWindows', () => {
  it('lays four windows out as an even, centred two-by-two grid', () => {
    const places = arrangeAgentHubFloatingWindows(4, area, 'grid')
    expect(places).toHaveLength(4)
    const [first, second, third] = places
    // Same gap between columns and between rows.
    expect(second.left - (first.left + first.width)).toBe(16)
    expect(third.top - (first.top + first.height)).toBe(16)
    // Centred in the area on both axes.
    const right = Math.max(...places.map((place) => place.left + place.width))
    expect(first.left - area.left).toBeCloseTo(area.left + area.width - right, 0)
  })

  it('centres a short last row under the full ones', () => {
    const [a, b, c] = arrangeAgentHubFloatingWindows(3, { ...area, width: 1100 }, 'grid')
    expect(a.top).toBe(b.top)
    expect(c.left + c.width / 2).toBeCloseTo((a.left + b.left + b.width) / 2, 0)
  })

  it('puts windows side by side or stacked on request, never smaller than a window can be', () => {
    const columns = arrangeAgentHubFloatingWindows(3, area, 'columns')
    expect(new Set(columns.map((place) => place.top)).size).toBe(1)
    const rows = arrangeAgentHubFloatingWindows(5, area, 'rows')
    expect(new Set(rows.map((place) => place.left)).size).toBe(1)
    expect(Math.min(...rows.map((place) => place.height))).toBeGreaterThanOrEqual(280)
  })
})
