import { expect, it } from 'vitest'
import { readDesktopPresence } from './desktop-away-state'

it.each([
  [0, true],
  [179, true],
  [180, false],
  [240, false]
])('exposes only presence and idle minutes at %s seconds', (idle, present) => {
  expect(
    readDesktopPresence({ getSystemIdleState: () => 'active', getSystemIdleTime: () => idle })
  ).toEqual({ present, idleMinutes: idle / 60 })
})
it('does not report a locked desktop as present or invent an idle time when it is unknown', () => {
  expect(
    readDesktopPresence({ getSystemIdleState: () => 'locked', getSystemIdleTime: () => 1 })
  ).toEqual({ present: false, idleMinutes: 1 / 60 })
  expect(
    readDesktopPresence({ getSystemIdleState: () => 'active', getSystemIdleTime: () => Number.NaN })
  ).toBeUndefined()
})
