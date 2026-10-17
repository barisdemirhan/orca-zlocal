import { expect, it, vi } from 'vitest'
import type { AgentJournalItemBody } from '../../shared/agent-session-journal-types'
import { CodexTurnOrdinals } from './codex-structured-item-translation'
import {
  adapterFor,
  fakeCodex,
  identityFor,
  THREAD_ID
} from './codex-structured-session-adapter-fixture'

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
  const resetTurn = vi.spyOn(CodexTurnOrdinals.prototype, 'forgetTurn')
  const adapter = adapterFor(codex, { resumeThreadId: THREAD_ID })
  try {
    await adapter.acquire({
      identity: identityFor('session-1'),
      fence: 7,
      spawnToken: 'reopen',
      events: {
        appendItem: (_identity, body) => bodies.push(body),
        appendTombstone: () => {},
        publish: () => {}
      }
    })

    expect(bodies).toContainEqual({
      kind: 'message',
      role: 'assistant',
      blocks: [{ type: 'text', text: 'Saved answer' }]
    })
    expect(resetTurn).toHaveBeenCalledWith(THREAD_ID, 'restored-turn')
    expect(codex.connections[0]?.calls.some((call) => call.method === 'thread/timeline/list')).toBe(
      false
    )
  } finally {
    await adapter.closeAll()
    resetTurn.mockRestore()
  }
})
