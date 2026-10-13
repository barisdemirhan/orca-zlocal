import { expect, it } from 'vitest'
import { agentHubMuteUntil } from './agent-hub-alert-mute'

it('uses fixed hourly durations and next-day 09:00 in local time across a month boundary', () => {
  const now = new Date(2026, 9, 31, 23, 30).getTime()
  expect(agentHubMuteUntil('hour', now)).toBe(now + 3_600_000)
  expect(agentHubMuteUntil('twoHours', now)).toBe(now + 7_200_000)
  expect(agentHubMuteUntil('tomorrow', now)).toBe(new Date(2026, 10, 1, 9, 0).getTime())
})
