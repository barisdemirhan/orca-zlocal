import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentHubOrbAwareness } from '../../../../shared/agent-hub-orb-awareness'
import { OrbAwarenessDelivery } from './agent-hub-orb-awareness-delivery'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
})
afterEach(() => vi.useRealTimers())
const snapshot = (count = 1): AgentHubOrbAwareness => ({
  observedAt: Date.now(),
  totalAgents: 1,
  truncated: false,
  agents: [
    {
      host: 'local',
      paneKey: 'pane',
      title: 'Lume',
      workspace: '/lume',
      agent: 'codex',
      state: 'waiting',
      since: 1
    }
  ],
  notices: Array.from({ length: count }, (_, index) => ({
    id: `request-${index}`,
    host: 'local',
    paneKey: 'pane',
    title: 'Lume',
    kind: 'decision',
    text: `Question ${index}: A or B?`
  }))
})
const packet = (text: string) => JSON.parse(text.slice(text.indexOf('\n') + 1))

it('waits for the conversation to be quiet, then drains every current question in bounded batches without duplicates', async () => {
  const append = vi.fn().mockResolvedValue(true)
  const stream = new OrbAwarenessDelivery(vi.fn())
  const context = { key: () => 'live-one', append }
  stream.updateContext({ context, snapshot: snapshot(5), busy: true })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(append).not.toHaveBeenCalled()
  stream.updateContext({ context, snapshot: snapshot(5), busy: false })
  await vi.advanceTimersByTimeAsync(6_000)
  const questions = append.mock.calls.flatMap(([text]) =>
    packet(text).newNotices.map((notice: { id: string }) => notice.id)
  )
  expect(questions).toEqual(['request-0', 'request-1', 'request-2', 'request-3', 'request-4'])
  stream.updateContext({ context, snapshot: snapshot(5), busy: false })
  await vi.advanceTimersByTimeAsync(20_000)
  expect(append).toHaveBeenCalledTimes(2)
  stream.dispose()
})

it('removes an answered request and replaces the global status instead of leaving stale question context', async () => {
  const append = vi.fn().mockResolvedValue(true)
  const stream = new OrbAwarenessDelivery(vi.fn())
  const context = { key: () => 'live-one', append }
  stream.updateContext({ context, snapshot: snapshot(), busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  const current = snapshot(0)
  current.agents[0]!.state = 'working'
  stream.updateContext({ context, snapshot: current, busy: false })
  await vi.advanceTimersByTimeAsync(5_000)
  expect(packet(append.mock.calls[1]![0])).toMatchObject({
    removedNoticeIds: ['request-0'],
    newNotices: [],
    agents: [{ state: 'working' }]
  })
  stream.dispose()
})

it('reports an ambiguous delivery and never blindly replays the same append', async () => {
  const append = vi.fn().mockRejectedValue(new Error('connection lost after possible acceptance'))
  const report = vi.fn()
  const stream = new OrbAwarenessDelivery(report)
  const context = { key: () => 'live-one', append }
  stream.updateContext({ context, snapshot: snapshot(), busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  expect(report).toHaveBeenLastCalledWith('unverifiable')
  stream.updateContext({ context, snapshot: snapshot(), busy: true })
  stream.updateContext({ context, snapshot: snapshot(), busy: false })
  await vi.advanceTimersByTimeAsync(20_000)
  expect(append).toHaveBeenCalledTimes(1)
  stream.updateContext({ context, snapshot: snapshot(0), busy: false })
  await vi.advanceTimersByTimeAsync(5_000)
  expect(packet(append.mock.calls[1]![0]).removedNoticeIds).toEqual(['request-0'])
  stream.dispose()
})

it('does not let an old Live acknowledgement commit into a new attempt or deliver after close', async () => {
  const pending = Promise.withResolvers<boolean>()
  const append = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(true)
  const report = vi.fn()
  let attempt: string | null = 'old'
  const context = { key: () => attempt, append }
  const stream = new OrbAwarenessDelivery(report)
  stream.updateContext({ context, snapshot: snapshot(), busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  attempt = 'new'
  stream.updateContext({ context, snapshot: snapshot(), busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  const calls = report.mock.calls.length
  pending.resolve(true)
  await Promise.resolve()
  expect(report).toHaveBeenCalledTimes(calls)
  expect(append).toHaveBeenCalledTimes(2)
  attempt = null
  stream.updateContext(null)
  await vi.advanceTimersByTimeAsync(20_000)
  expect(append).toHaveBeenCalledTimes(2)
  stream.dispose()
})

it('keeps extreme host identities and a backlog of resolved questions within the Live text limit without losing closures', async () => {
  const append = vi.fn().mockResolvedValue(true)
  const stream = new OrbAwarenessDelivery(vi.fn())
  const context = { key: () => 'live-one', append }
  const current = snapshot(3)
  current.agents[0]!.host = 'h'.repeat(2_000)
  current.agents[0]!.paneKey = 'p'.repeat(2_000)
  current.notices.forEach((notice, index) => {
    notice.id = `${index}${'i'.repeat(3_999)}`
    notice.host = 'h'.repeat(2_000)
    notice.paneKey = 'p'.repeat(2_000)
    notice.text = 'q'.repeat(2_400)
  })
  stream.updateContext({ context, snapshot: current, busy: false })
  await vi.advanceTimersByTimeAsync(16_000)
  expect(append.mock.calls.flatMap(([text]) => packet(text).newNotices)).toHaveLength(3)
  stream.updateContext({ context, snapshot: snapshot(0), busy: false })
  await vi.advanceTimersByTimeAsync(16_000)
  expect(append.mock.calls.flatMap(([text]) => packet(text).removedNoticeIds)).toEqual(
    current.notices.map((notice) => notice.id)
  )
  for (const [text] of append.mock.calls) {
    expect(text.length).toBeLessThanOrEqual(8_192)
  }
  const calls = append.mock.calls.length
  await vi.advanceTimersByTimeAsync(20_000)
  expect(append).toHaveBeenCalledTimes(calls)
  stream.dispose()
})

it('ignores title churn and batches agent state changes into one turn a minute', async () => {
  const append = vi.fn().mockResolvedValue(true)
  const stream = new OrbAwarenessDelivery(vi.fn())
  const context = { key: () => 'live-one', append }
  stream.updateContext({ context, snapshot: snapshot(0), busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  expect(append).toHaveBeenCalledTimes(1)
  for (const index of [1, 2, 3]) {
    const current = snapshot(0)
    current.agents[0]!.title = `⠂ Lume ${index}`
    current.agents[0]!.since = index
    stream.updateContext({ context, snapshot: current, busy: false })
    await vi.advanceTimersByTimeAsync(6_000)
  }
  expect(append).toHaveBeenCalledTimes(1)
  for (const state of ['working', 'done']) {
    const current = snapshot(0)
    current.agents[0]!.state = state
    stream.updateContext({ context, snapshot: current, busy: false })
    await vi.advanceTimersByTimeAsync(10_000)
  }
  expect(append).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(60_000)
  expect(append).toHaveBeenCalledTimes(2)
  expect(packet(append.mock.calls[1]![0])).toMatchObject({ agents: [{ state: 'done' }] })
  await vi.advanceTimersByTimeAsync(120_000)
  expect(append).toHaveBeenCalledTimes(2)
  stream.dispose()
})

it('sends a new notice promptly even while a state-only update is waiting its minute', async () => {
  const append = vi.fn().mockResolvedValue(true)
  const stream = new OrbAwarenessDelivery(vi.fn())
  const context = { key: () => 'live-one', append }
  stream.updateContext({ context, snapshot: snapshot(0), busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  const working = snapshot(0)
  working.agents[0]!.state = 'working'
  stream.updateContext({ context, snapshot: working, busy: false })
  await vi.advanceTimersByTimeAsync(5_000)
  const asking = snapshot(1)
  asking.agents[0]!.state = 'idle'
  stream.updateContext({ context, snapshot: asking, busy: false })
  await vi.advanceTimersByTimeAsync(1_000)
  expect(append).toHaveBeenCalledTimes(2)
  expect(packet(append.mock.calls[1]![0])).toMatchObject({
    newNotices: [{ id: 'request-0' }],
    agents: [{ state: 'idle' }]
  })
  await vi.advanceTimersByTimeAsync(120_000)
  expect(append).toHaveBeenCalledTimes(2)
  stream.dispose()
})
