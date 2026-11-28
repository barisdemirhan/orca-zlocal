import { expect, it } from 'vitest'
import { planOrbThrow, type OrbPoint } from './agent-hub-orb-motion'

const clamp = (point: OrbPoint): OrbPoint => ({
  x: Math.max(60, Math.min(900, point.x)),
  y: Math.max(80, Math.min(600, point.y))
})

it('keeps every thrown point, and so the stored rest spot, inside the clamp', () => {
  for (const velocity of [
    { x: 2200, y: 0 },
    { x: -2200, y: 1800 },
    { x: 300, y: -2200 },
    { x: -900, y: -900 }
  ]) {
    const plan = planOrbThrow({ from: { x: 400, y: 300 }, velocity, clamp, dock: null })
    expect(plan.docked).toBe(false)
    expect(
      plan.path.every((point) => clamp(point).x === point.x && clamp(point).y === point.y)
    ).toBe(true)
    expect(plan.rest).toEqual(plan.path.at(-1))
  }
})

it('rests on the dock spot when a throw passes within the magnet range', () => {
  const dock = { x: 800, y: 300 }
  const plan = planOrbThrow({ from: { x: 400, y: 300 }, velocity: { x: 1500, y: 0 }, clamp, dock })
  expect(plan.docked).toBe(true)
  expect(plan.rest).toEqual(dock)
})
