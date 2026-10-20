import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentHubEvent, AgentHubRequest } from '../../../shared/agent-hub-requests'
import { AgentHubLedger } from './agent-hub-ledger'

const caller = { paneKey: 'pane-1', terminalHandle: 'term-1', agentType: 'codex', title: 'Worker' }
const other = { paneKey: 'pane-2', terminalHandle: 'term-2' }
const question = { question: 'Ship?', options: ['Yes', 'No'], multi: false }
const notification = { text: 'Ready', level: 'done' as const, sound: false, links: [] }
let ledger: AgentHubLedger
let events: AgentHubEvent[]
function latest(kind: AgentHubRequest['kind']): AgentHubRequest {
  const request = events.findLast((event) => event.kind === kind)
  if (!request || request.kind === 'progress' || request.kind === 'closed') {
    throw new Error(`Missing ${kind}`)
  }
  return request
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  events = []
  ledger = new AgentHubLedger(
    (event) => events.push(event),
    () => Date.now()
  )
  ledger.registerDesktop('A')
})
afterEach(() => {
  ledger.dispose()
  vi.useRealTimers()
})

describe('Agent Hub ledger', () => {
  it('keeps needs-you notices until dismissed while ordinary notices expire', async () => {
    const notice = ledger.notify(caller, caller, { ...notification, level: 'needs-you' })
    ledger.notify(caller, caller, notification)
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000)
    expect(ledger.snapshot().requests).toMatchObject([
      { requestId: notice.requestId, kind: 'notify', level: 'needs-you' }
    ])
    ledger.respond(notice.requestId, { kind: 'ack' }, 'A')
    expect(ledger.snapshot().requests).toEqual([])
  })

  it('allows time for human consent before starting the short operation deadline', async () => {
    const done = ledger.operate(caller, other, { kind: 'mirror', action: 'open' })
    const consent = latest('consent')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(ledger.snapshot().requests).toContainEqual(consent)
    ledger.respond(consent.requestId, { kind: 'consent', decision: 'once' }, 'A')
    await Promise.resolve()
    ledger.respond(latest('mirror').requestId, { kind: 'ack' }, 'A')
    await expect(done).resolves.toHaveProperty('requestId')
  })

  it('settles an away query when the last subscription of a silent desktop disconnects', async () => {
    const stopB = ledger.registerDesktop('B')
    const stopOtherB = ledger.registerDesktop('B')
    const answer = ledger.ask(
      caller,
      caller,
      { ...question, recommended: 1, ifAway: 'recommended' },
      60_000
    )
    ledger.respond(
      latest('presence').requestId,
      { kind: 'presence', present: false, idleMinutes: 8 },
      'A'
    )
    stopB()
    expect(ledger.snapshot().requests.some((request) => request.kind === 'presence')).toBe(true)
    stopOtherB()
    await expect(answer).resolves.toMatchObject({ by: 'away-default', answer: 'Yes' })
  })

  it('shares a query limit across presence and status without publishing refused queries', async () => {
    for (let index = 0; index < 30; index += 1) {
      if (index % 2 === 0) {
        const result = ledger.presence(caller, caller)
        ledger.respond(
          latest('presence').requestId,
          { kind: 'presence', present: true, idleMinutes: 0 },
          'A'
        )
        await result
      } else {
        const result = ledger.status(caller, caller)
        ledger.respond(
          latest('status').requestId,
          { kind: 'status', mirrors: [], parked: [], waiting: [] },
          'A'
        )
        await result
      }
    }
    const count = events.length
    await expect(ledger.presence(caller, caller)).rejects.toMatchObject({
      code: 'rate_limited',
      data: { retryAfterMs: 60_000 }
    })
    await expect(ledger.status(caller, caller)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(events).toHaveLength(count)
    const otherResult = ledger.presence(other, other)
    ledger.respond(
      latest('presence').requestId,
      { kind: 'presence', present: true, idleMinutes: 0 },
      'A'
    )
    await otherResult
    await vi.advanceTimersByTimeAsync(60_000)
    const retried = ledger.status(caller, caller)
    ledger.respond(
      latest('status').requestId,
      { kind: 'status', mirrors: [], parked: [], waiting: [] },
      'A'
    )
    await expect(retried).resolves.toEqual({ mirrors: [], parked: [], waiting: [] })
  })

  it('returns optional global Orb awareness in status while accepting older desktop responses', async () => {
    const orbAwareness = {
      observedAt: Date.now(),
      totalAgents: 1,
      truncated: false,
      agents: [
        {
          host: 'remote',
          paneKey: 'other',
          title: 'Lume',
          workspace: '/lume',
          agent: 'codex',
          state: 'waiting',
          since: 1
        }
      ],
      notices: [
        {
          id: 'ask',
          host: 'remote',
          paneKey: 'other',
          title: 'Lume',
          kind: 'decision' as const,
          text: 'Which option? A or B?'
        }
      ]
    }
    const answer = ledger.status(caller, caller)
    ledger.respond(
      latest('status').requestId,
      { kind: 'status', mirrors: [], parked: [], waiting: [], orbAwareness },
      'A'
    )
    await expect(answer).resolves.toMatchObject({ orbAwareness })
    const legacy = ledger.status(caller, caller)
    ledger.respond(
      latest('status').requestId,
      { kind: 'status', mirrors: [], parked: [], waiting: [] },
      'A'
    )
    await expect(legacy).resolves.toEqual({ mirrors: [], parked: [], waiting: [] })
  })

  it('limits Orb notifications by session identity while keeping pane buckets separate', () => {
    const orb = { ...caller, kind: 'orb' as const, sessionId: 'codex_orb' }
    for (let index = 0; index < 6; index += 1) {
      ledger.notify(orb, caller, notification)
    }
    expect(() =>
      ledger.notify({ ...orb, paneKey: 'different-routing-key' }, caller, notification)
    ).toThrow(expect.objectContaining({ code: 'rate_limited' }))
    expect(() =>
      ledger.notify({ ...orb, sessionId: 'codex_other' }, caller, notification)
    ).not.toThrow()
    expect(() => ledger.notify(caller, caller, notification)).not.toThrow()
  })

  it('binds pending and resumed Orb questions to the session even when the routing key changes', async () => {
    const orb = { ...caller, kind: 'orb' as const, sessionId: 'codex_orb' }
    const pending = Array.from({ length: 3 }, () => {
      const answer = ledger.ask(orb, caller, question, 60_000)
      return { answer, requestId: latest('ask').requestId }
    })
    await expect(
      ledger.ask({ ...orb, paneKey: 'changed' }, caller, question, 60_000)
    ).rejects.toMatchObject({ code: 'rate_limited' })
    await expect(
      ledger.resume({ ...orb, sessionId: 'codex_other' }, pending[0].requestId)
    ).rejects.toMatchObject({ code: 'request_not_found' })
    for (const entry of pending) {
      ledger.respond(entry.requestId, { kind: 'ask', answer: 'Yes', index: 1 }, 'A')
    }
    await Promise.all(pending.map((entry) => entry.answer))
    await expect(
      ledger.resume({ ...orb, paneKey: 'changed' }, pending[0].requestId)
    ).resolves.toMatchObject({ answer: 'Yes' })
  })
  it('lets the first desktop answer and tells the others to close the card', async () => {
    ledger.registerDesktop('B')
    const answer = ledger.ask(caller, caller, question, 60_000)
    const request = latest('ask')
    ledger.respond(request.requestId, { kind: 'ask', answer: 'Yes', index: 1 }, 'B')
    expect(() =>
      ledger.respond(request.requestId, { kind: 'ask', answer: 'No', index: 2 }, 'A')
    ).toThrow(expect.objectContaining({ code: 'already_resolved' }))
    await expect(answer).resolves.toMatchObject({
      answer: 'Yes',
      index: 1,
      desktop: 'B',
      by: 'human'
    })
    expect(events.at(-1)).toMatchObject({
      kind: 'closed',
      requestId: request.requestId,
      reason: 'responded',
      result: { answer: 'Yes' }
    })
    expect(ledger.snapshot().requests).toEqual([])
  })

  it('refuses a response of the wrong kind or with an out-of-range answer, keeping the ask pending', async () => {
    const answer = ledger.ask(caller, caller, question, 10)
    const { requestId } = latest('ask')
    for (const result of [
      { kind: 'ack' as const },
      { kind: 'ask' as const, answer: 'Bad', index: 3 }
    ]) {
      expect(() => ledger.respond(requestId, result, 'A')).toThrow(
        expect.objectContaining({ code: 'invalid_argument' })
      )
    }
    expect(ledger.snapshot().requests).toHaveLength(1)
    ledger.respond(requestId, { kind: 'ask', answer: 'custom', index: null }, 'A')
    await expect(answer).resolves.toMatchObject({ answer: 'custom', index: null })
  })

  it('preserves a disconnected question and resumes its original result without another card', async () => {
    const controller = new AbortController()
    const disconnected = ledger.ask(caller, caller, question, 60_000, undefined, controller.signal)
    const { requestId } = latest('ask')
    const rejected = expect(disconnected).rejects.toMatchObject({
      code: 'connection_lost',
      data: { requestId }
    })
    controller.abort()
    await rejected
    expect(ledger.snapshot().requests).toHaveLength(1)
    await expect(ledger.resume(other, requestId)).rejects.toMatchObject({
      code: 'request_not_found'
    })
    ledger.respond(requestId, { kind: 'ask', answer: 'No', index: 2 }, 'A')
    await expect(ledger.resume(caller, requestId)).resolves.toMatchObject({ answer: 'No' })
    expect(events.filter((event) => event.kind === 'ask')).toHaveLength(1)
  })

  it('preserves a human multi-selection and rejects duplicate indices without closing the ask', async () => {
    const answer = ledger.ask(caller, caller, { ...question, multi: true }, 60_000)
    const { requestId } = latest('ask')
    expect(() =>
      ledger.respond(requestId, { kind: 'ask', answer: 'Both', index: null, indices: [1, 1] }, 'A')
    ).toThrow(expect.objectContaining({ code: 'invalid_argument' }))
    ledger.respond(requestId, { kind: 'ask', answer: 'Both', index: null, indices: [1, 2] }, 'A')
    await expect(answer).resolves.toMatchObject({
      answer: 'Both',
      index: null,
      indices: [1, 2],
      by: 'human'
    })
  })

  it('expires an ask without a default and returns the timeout on resume', async () => {
    const answer = ledger.ask(caller, caller, question, 100)
    const { requestId } = latest('ask')
    const rejected = expect(answer).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(events.at(-1)).toMatchObject({ kind: 'closed', reason: 'timeout' })
    await expect(ledger.resume(caller, requestId)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('uses the recommended option at the deadline when presence is unavailable', async () => {
    const answer = ledger.ask(
      caller,
      caller,
      { ...question, recommended: 2, ifAway: 'recommended' },
      100
    )
    await vi.advanceTimersByTimeAsync(100)
    await expect(answer).resolves.toMatchObject({
      index: 2,
      answer: 'No',
      by: 'timeout',
      desktop: 'host'
    })
  })

  it('takes the away default only after every desktop says away', async () => {
    ledger.registerDesktop('B')
    const answer = ledger.ask(
      caller,
      caller,
      { ...question, recommended: 1, ifAway: 'recommended' },
      60_000
    )
    const { requestId } = latest('presence')
    ledger.respond(requestId, { kind: 'presence', present: false, idleMinutes: 10 }, 'A')
    expect(ledger.snapshot().requests.some((request) => request.kind === 'ask')).toBe(true)
    ledger.respond(requestId, { kind: 'presence', present: false, idleMinutes: 20 }, 'B')
    await expect(answer).resolves.toMatchObject({ by: 'away-default', answer: 'Yes' })
  })

  it('reports presence if any desktop is present, despite an earlier away report', async () => {
    ledger.registerDesktop('B')
    const result = ledger.presence(caller, caller)
    const { requestId } = latest('presence')
    ledger.respond(requestId, { kind: 'presence', present: false, idleMinutes: 30 }, 'A')
    ledger.respond(requestId, { kind: 'presence', present: true, idleMinutes: 0 }, 'B')
    await expect(result).resolves.toEqual({ present: true, idleMinutes: 0 })
  })

  it('fails immediately without a capable desktop and removes registrations idempotently', async () => {
    ledger.dispose()
    expect(() => ledger.notify(caller, caller, notification)).toThrow(
      expect.objectContaining({ code: 'no_desktop' })
    )
    await expect(ledger.ask(caller, caller, question, 100)).rejects.toMatchObject({
      code: 'no_desktop'
    })
    const stopA = ledger.registerDesktop('A')
    const stopB = ledger.registerDesktop('A')
    stopA()
    stopA()
    expect(ledger.notify(caller, caller, notification)).toHaveProperty('requestId')
    stopB()
    expect(() => ledger.updateProgress(caller, caller, 'Test')).toThrow(
      expect.objectContaining({ code: 'no_desktop' })
    )
  })

  it('applies per-caller sliding limits and returns the exact retry time', async () => {
    for (let i = 0; i < 6; i++) {
      ledger.notify(caller, caller, notification)
    }
    vi.setSystemTime(10_000)
    expect(() => ledger.notify(caller, caller, notification)).toThrow(
      expect.objectContaining({ code: 'rate_limited', data: { retryAfterMs: 50_000 } })
    )
    expect(ledger.notify(other, other, notification)).toHaveProperty('requestId')
    await vi.advanceTimersByTimeAsync(50_000)
    expect(ledger.notify(caller, caller, notification)).toHaveProperty('requestId')
  })

  it('limits peek separately and groups mirror, arrange and canvas together', async () => {
    const operations = [
      { kind: 'mirror' as const, action: 'open' as const },
      { kind: 'arrange' as const },
      { kind: 'canvas' as const, action: 'close' as const }
    ]
    for (let i = 0; i < 10; i++) {
      const operation = operations[i % operations.length]
      const done = ledger.operate(caller, caller, operation)
      ledger.respond(latest(operation.kind).requestId, { kind: 'ack' }, 'A')
      await done
    }
    await expect(ledger.operate(caller, caller, operations[0])).rejects.toMatchObject({
      code: 'rate_limited'
    })
    for (let i = 0; i < 6; i++) {
      const done = ledger.operate(caller, caller, { kind: 'peek', link: 'https://example.com' })
      ledger.respond(latest('peek').requestId, { kind: 'ack' }, 'A')
      await done
    }
    await expect(
      ledger.operate(caller, caller, { kind: 'peek', link: '/file' })
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('limits pending asks, while allowing a resolved ask to release its slot', async () => {
    const answers = Array.from({ length: 3 }, () => ledger.ask(caller, caller, question, 1_000))
    await expect(ledger.ask(caller, caller, question, 1_000)).rejects.toMatchObject({
      code: 'rate_limited',
      data: { retryAfterMs: 1_000 }
    })
    const requests = ledger.snapshot().requests
    requests.forEach((request) =>
      ledger.respond(request.requestId, { kind: 'ask', answer: 'Yes', index: 1 }, 'A')
    )
    await Promise.all(answers)
    const next = ledger.ask(caller, caller, question, 1_000)
    ledger.respond(latest('ask').requestId, { kind: 'ask', answer: 'No', index: 2 }, 'A')
    await next
  })

  it.each(['once', 'session', 'deny'] as const)(
    'enforces %s consent before touching another pane',
    async (decision) => {
      const operation = { kind: 'mirror' as const, action: 'minimize' as const }
      const done = ledger.operate(caller, other, operation)
      const outcome =
        decision === 'deny' ? expect(done).rejects.toMatchObject({ code: 'denied_by_user' }) : null
      expect(events.some((event) => event.kind === 'mirror')).toBe(false)
      const consent = latest('consent')
      expect(consent).toMatchObject({ caller, target: other, operation })
      ledger.respond(consent.requestId, { kind: 'consent', decision }, 'A')
      if (outcome) {
        await outcome
        expect(events.some((event) => event.kind === 'mirror')).toBe(false)
        return
      }
      await Promise.resolve()
      ledger.respond(latest('mirror').requestId, { kind: 'ack' }, 'A')
      await done
      const next = ledger.operate(caller, other, operation)
      expect(events.filter((event) => event.kind === 'consent')).toHaveLength(
        decision === 'session' ? 1 : 2
      )
      if (decision === 'once') {
        ledger.respond(latest('consent').requestId, { kind: 'consent', decision: 'once' }, 'A')
      }
      await Promise.resolve()
      ledger.respond(latest('mirror').requestId, { kind: 'ack' }, 'A')
      await next
    }
  )

  it('closes an unanswered UI request after ten seconds', async () => {
    const result = ledger.status(caller, caller)
    const rejected = expect(result).rejects.toMatchObject({ code: 'no_response' })
    await vi.advanceTimersByTimeAsync(10_000)
    await rejected
    expect(events.at(-1)).toMatchObject({ kind: 'closed', reason: 'no_response' })
  })

  it('coalesces progress and auto-clears ten minutes after the latest update', async () => {
    ledger.updateProgress(caller, caller, 'One')
    ledger.updateProgress(caller, caller, 'Two')
    ledger.updateProgress(caller, caller, 'Three')
    expect(events.filter((event) => event.kind === 'progress')).toHaveLength(1)
    expect(ledger.snapshot().progress[0].text).toBe('Three')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(events.at(-1)).toMatchObject({ kind: 'progress', text: 'Three' })
    ledger.updateProgress(caller, caller, 'Four')
    await vi.advanceTimersByTimeAsync(599_999)
    expect(ledger.snapshot().progress[0].text).toBe('Four')
    await vi.advanceTimersByTimeAsync(1)
    expect(events.at(-1)).toMatchObject({ kind: 'progress', text: null })
    expect(ledger.snapshot().progress).toEqual([])
    const count = events.length
    ledger.updateProgress(caller, caller, 'Back')
    expect(events).toHaveLength(count)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(events.at(-1)).toMatchObject({ kind: 'progress', text: 'Back' })
  })

  it('snapshots live notifications, asks, consents and latest progress', async () => {
    ledger.notify(caller, caller, notification)
    ledger.updateProgress(caller, caller, 'Building')
    const ask = ledger.ask(caller, caller, question, 100)
    const operation = ledger.operate(caller, other, { kind: 'peek', link: '/remote/file' })
    expect(ledger.snapshot().requests.map((request) => request.kind)).toEqual([
      'notify',
      'ask',
      'consent'
    ])
    expect(ledger.snapshot().progress[0]).toMatchObject({ text: 'Building', caller })
    ledger.respond(latest('ask').requestId, { kind: 'ask', answer: 'Yes', index: 1 }, 'A')
    const denied = expect(operation).rejects.toMatchObject({ code: 'denied_by_user' })
    ledger.respond(latest('consent').requestId, { kind: 'consent', decision: 'deny' }, 'A')
    await Promise.all([ask, denied])
  })

  it('coalesces explicit progress clears without allowing a second publish in the same second', async () => {
    ledger.updateProgress(caller, caller, 'One')
    ledger.updateProgress(caller, caller, null)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(events.at(-1)).toMatchObject({ kind: 'progress', text: null })
    expect(ledger.snapshot().progress).toEqual([])
    ledger.updateProgress(caller, caller, 'Two')
    expect(events.filter((event) => event.kind === 'progress')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(events.at(-1)).toMatchObject({ kind: 'progress', text: 'Two' })
  })
})

it('manages a descendant without consent, but requests consent again once its parent link is pruned', async () => {
  ledger.dispose()
  const parents = new Map([
    ['pane-2', 'pane-middle'],
    ['pane-middle', caller.paneKey]
  ])
  ledger = new AgentHubLedger(
    (event) => events.push(event),
    Date.now,
    (pane) => parents.get(pane)
  )
  ledger.registerDesktop('A')
  const action = ledger.operate(caller, other, { kind: 'mirror', action: 'add' })
  expect(events.some((event) => event.kind === 'consent')).toBe(false)
  ledger.respond(latest('mirror').requestId, { kind: 'ack' }, 'A')
  await expect(action).resolves.toHaveProperty('requestId')
  parents.delete('pane-middle')
  const pending = ledger.operate(caller, other, { kind: 'mirror', action: 'add' })
  expect(latest('consent')).toMatchObject({ target: other })
  ledger.respond(latest('consent').requestId, { kind: 'consent', decision: 'deny' }, 'A')
  await expect(pending).rejects.toMatchObject({ code: 'denied_by_user' })
})

it('does not grant consent authority through a lineage cycle or from a child to its parent', async () => {
  ledger.dispose()
  const parents = new Map([
    ['pane-2', 'loop'],
    ['loop', 'pane-2'],
    [caller.paneKey, 'pane-2']
  ])
  ledger = new AgentHubLedger(
    (event) => events.push(event),
    Date.now,
    (pane) => parents.get(pane)
  )
  ledger.registerDesktop('A')
  const pending = ledger.operate(caller, other, { kind: 'mirror', action: 'add' })
  ledger.respond(latest('consent').requestId, { kind: 'consent', decision: 'deny' }, 'A')
  await expect(pending).rejects.toMatchObject({ code: 'denied_by_user' })
})
