import { expect, it } from 'vitest'
import type { AgentJournalItemBody } from '../../shared/agent-session/journal/agent-session-journal-types'
import {
  adapterFor,
  fakeCodex,
  identityFor,
  THREAD_ID
} from './structured/session-lifecycle/codex-structured-session-adapter-fixture'

it('reopens an ordinary conversation through the turn restore resets without reading Live pages', async () => {
  const bodies: AgentJournalItemBody[] = []
  const codex = fakeCodex({
    'thread/resume': () => ({
      thread: {
        id: THREAD_ID,
        turns: [
          {
            id: 'restored-turn',
            items: [{ type: 'agentMessage', id: 'restored-answer', text: 'Saved answer' }]
          }
        ]
      }
    }),
    'thread/timeline/list': () => ({ data: [], nextCursor: 'another-Live-page' })
  })
  const adapter = adapterFor(codex, { resumeThreadId: THREAD_ID })
  try {
    const acquired = await adapter.acquire({
      identity: identityFor('session-1'),
      fence: 7,
      spawnToken: 'reopen',
      events: {
        appendItem: (_identity, body) => bodies.push(body),
        appendTombstone: () => {},
        publish: () => {}
      }
    })
    await adapter.open({
      sessionId: 'session-1',
      fence: 7,
      acquisitionGeneration: acquired.acquisitionGeneration ?? null,
      signal: new AbortController().signal
    })

    expect(codex.connections[0]?.calls.some((call) => call.method === 'thread/timeline/list')).toBe(
      false
    )
  } finally {
    await adapter.closeAll()
  }
})
