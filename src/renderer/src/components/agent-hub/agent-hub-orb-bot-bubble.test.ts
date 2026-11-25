import { describe, expect, it } from 'vitest'
import {
  EMPTY_SUGGESTION_LEDGER,
  detectOrbBotRunEvents,
  orbSuggestionAllowed,
  pickOrbBotBubble,
  recordOrbSuggestionShown,
  type OrbBotBubble,
  type OrbBotRunFacts
} from './agent-hub-orb-bot-bubble'

const run = (runId: string, status: OrbBotRunFacts['status']): OrbBotRunFacts => ({
  runId,
  automationId: 'auto',
  name: 'Tidy',
  status,
  sessionId: null,
  running: status === 'dispatched',
  at: 1
})

describe('run transitions', () => {
  it('announces only runs seen running, never old finished ones', () => {
    const first = detectOrbBotRunEvents(new Map(), [run('a', 'completed'), run('b', 'dispatched')])
    expect(first.events).toEqual([])
    const next = detectOrbBotRunEvents(first.running, [
      run('a', 'completed'),
      run('b', 'completed')
    ])
    expect(next.events.map((event) => [event.runId, event.kind])).toEqual([['b', 'result']])
    expect(detectOrbBotRunEvents(first.running, [run('b', 'dispatch_failed')]).events[0].kind).toBe(
      'failure'
    )
  })
})

describe('bubble priority', () => {
  const event = { runId: 'a', automationId: 'auto', name: 'n', sessionId: null, at: 1 }
  const all: OrbBotBubble[] = [
    { kind: 'suggestion', key: 's', botKey: 'b', suggestionId: 's', text: 't' },
    { kind: 'other', key: 'o', botKey: 'b', uid: 'u' },
    { kind: 'brief', key: 'brief' },
    { kind: 'result', key: 'r', event: { ...event, kind: 'result' } },
    { kind: 'failure', key: 'f', event: { ...event, kind: 'failure' } }
  ]
  it('picks failure, result, brief, other, suggestion in that order and nothing while busy', () => {
    const order: string[] = []
    let rest = all
    for (let i = 0; i < all.length; i++) {
      const next = pickOrbBotBubble(rest, false)
      order.push(next?.kind ?? '')
      rest = rest.filter((bubble) => bubble !== next)
    }
    expect(order).toEqual(['failure', 'result', 'brief', 'other', 'suggestion'])
    expect(pickOrbBotBubble(all, true)).toBeNull()
  })
})

describe('suggestion budget', () => {
  const noon = new Date(2026, 10, 25, 12).getTime()
  it('allows three per local day and never repeats an id', () => {
    let ledger = EMPTY_SUGGESTION_LEDGER
    for (const id of ['a', 'b', 'c']) {
      expect(orbSuggestionAllowed(ledger, id, noon)).toBe(true)
      ledger = recordOrbSuggestionShown(ledger, id, noon)
    }
    expect(orbSuggestionAllowed(ledger, 'd', noon)).toBe(false)
    const tomorrow = noon + 24 * 3_600_000
    expect(orbSuggestionAllowed(ledger, 'd', tomorrow)).toBe(true)
    expect(orbSuggestionAllowed(ledger, 'a', tomorrow)).toBe(false)
  })
})
