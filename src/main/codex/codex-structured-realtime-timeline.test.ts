import { describe, expect, it, vi } from 'vitest'
import { CodexAppServerRequestError } from './app-server/codex-app-server-request-error'
import {
  readCodexRealtimeTimeline,
  type CodexTimelineEntry
} from './codex-structured-realtime-timeline'

const THREAD = 'thread-native-voice'

// Native 0.163.0 ThreadTimelineListResponse and ThreadRealtimeItem fixtures.
const SPOKEN = {
  type: 'realtime',
  position: 3,
  item: {
    id: 'spoken-1',
    realtimeSessionId: 'voice-1',
    type: 'transcriptSegment',
    role: 'assistant',
    text: 'The changes are ready.'
  }
} satisfies Extract<CodexTimelineEntry, { type: 'realtime' }>

function transcript(position: number): CodexTimelineEntry {
  return { ...SPOKEN, position, item: { ...SPOKEN.item, id: `spoken-${position}` } }
}

function page(data: readonly unknown[], nextCursor: string | null = null) {
  return { data, nextCursor, activeRealtimeSessionAtPageStart: null }
}

describe('Codex canonical realtime timeline reads', () => {
  it('accepts the camelCase turn boundaries codex-cli 0.163.0 sends', async () => {
    const request = vi.fn().mockResolvedValueOnce(
      page([
        { type: 'turnStarted', position: 1, turnId: 'turn-1', startedAt: 1_700_000_000 },
        {
          type: 'turnCompleted',
          position: 2,
          turnId: 'turn-1',
          status: 'completed',
          startedAt: 1_700_000_000,
          completedAt: 1_700_000_002,
          durationMs: 2_000,
          error: null
        }
      ])
    )
    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toEqual({
      status: 'ready',
      entries: [
        { type: 'turnStarted', position: 1, turn_id: 'turn-1', started_at: 1_700_000_000 },
        {
          type: 'turnCompleted',
          position: 2,
          turn_id: 'turn-1',
          status: 'completed',
          started_at: 1_700_000_000,
          completed_at: 1_700_000_002,
          duration_ms: 2_000,
          error: null
        }
      ]
    })
  })

  it('accepts camelCase promoted-item fields and still rejects a turn boundary without an id', async () => {
    const promoted = {
      type: 'realtime',
      position: 1,
      item: {
        id: 'p-1',
        realtimeSessionId: 'voice-1',
        type: 'bemItemPromoted',
        turnId: 'turn-1',
        itemId: 'item-1',
        presentation: { type: 'wholeItem' }
      }
    }
    const ready = vi.fn().mockResolvedValueOnce(page([promoted]))
    expect((await readCodexRealtimeTimeline({ request: ready }, THREAD)).status).toBe('ready')
    const bad = vi.fn().mockResolvedValueOnce(page([{ type: 'turnStarted', position: 1 }]))
    expect(await readCodexRealtimeTimeline({ request: bad }, THREAD)).toEqual({ status: 'unknown' })
  })

  it('reads native item and turn boundaries across pages before returning rollout order', async () => {
    const started: CodexTimelineEntry = {
      type: 'turnStarted',
      position: 1,
      turn_id: 'turn-1',
      started_at: 1_700_000_000
    }
    const ordinary: CodexTimelineEntry = {
      type: 'item',
      position: 2,
      turnId: 'turn-1',
      item: { type: 'agentMessage', id: 'answer-1', text: 'Checking the changes.' }
    }
    const completed: CodexTimelineEntry = {
      type: 'turnCompleted',
      position: 4,
      turn_id: 'turn-1',
      status: 'completed',
      started_at: 1_700_000_000,
      completed_at: 1_700_000_002,
      duration_ms: 2_000,
      error: null
    }
    const request = vi
      .fn()
      .mockResolvedValueOnce(page([SPOKEN, completed], 'older-page'))
      .mockResolvedValueOnce(page([started, ordinary]))

    expect(await readCodexRealtimeTimeline({ request }, THREAD, 20_000)).toEqual({
      status: 'ready',
      entries: [started, ordinary, SPOKEN, completed]
    })
    expect(request.mock.calls).toEqual([
      ['thread/timeline/list', { threadId: THREAD, limit: 50 }, { timeoutMs: 5_000 }],
      [
        'thread/timeline/list',
        { threadId: THREAD, limit: 50, cursor: 'older-page' },
        { timeoutMs: 5_000 }
      ]
    ])
  })

  it.each([
    ['a malformed entry', { data: [{ ...SPOKEN, position: -1 }], nextCursor: null }],
    [
      'a missing native voice identity',
      {
        data: [
          {
            type: 'realtime',
            position: 4,
            item: {
              id: 'missing-session',
              type: 'transcriptSegment',
              role: 'assistant',
              text: 'A valid transcript without its voice identity'
            }
          }
        ]
      }
    ],
    [
      'a canonical transcript with a numeric text value',
      page([{ ...SPOKEN, position: 4, item: { ...SPOKEN.item, text: 7 } }])
    ],
    ['an oversized page', page(Array.from({ length: 51 }, (_, index) => transcript(index + 4)))],
    [
      'a repeated rollout position',
      page([{ ...SPOKEN, item: { ...SPOKEN.item, id: 'another-item' } }])
    ],
    ['a repeated cursor', page([transcript(4)], 'next-page')]
  ] as const)('admits no partial history when a later page has %s', async (_label, invalidPage) => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(page([SPOKEN], 'next-page'))
      .mockResolvedValueOnce(invalidPage)

    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toEqual({ status: 'unknown' })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('distinguishes an oversized payload from a retryable history read failure', async () => {
    const request = vi.fn().mockResolvedValue(
      page([
        {
          type: 'item',
          position: 4,
          turnId: 'turn-1',
          item: { type: 'agentMessage', id: 'oversized-answer', text: 'x'.repeat(16 * 1024 * 1024) }
        }
      ])
    )
    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toEqual({ status: 'limit' })
    expect(request).toHaveBeenCalledOnce()
  })

  it.each([
    [1024, 'ready'],
    [1025, 'limit']
  ] as const)('classifies a history of %i entries as %s', async (total, status) => {
    let offset = 0
    const request = vi.fn(async () => {
      const data = Array.from({ length: Math.min(50, total - offset) }, (_, index) =>
        transcript(offset + index)
      )
      offset += data.length
      return page(data, offset < total ? `page-${offset}` : null)
    })

    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toMatchObject({ status })
    expect(request).toHaveBeenCalledTimes(21)
  })

  it('bounds a provider that keeps returning empty pages with new cursors', async () => {
    let cursor = 0
    const request = vi.fn(async () => page([], `page-${++cursor}`))

    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toEqual({ status: 'unknown' })
    expect(request).toHaveBeenCalledTimes(100)
  })

  it.each([
    [-32601, 'unsupported'],
    [-32603, 'unknown']
  ] as const)('classifies a native RPC refusal with code %i as %s', async (code, status) => {
    const request = vi
      .fn()
      .mockRejectedValue(
        new CodexAppServerRequestError('thread/timeline/list', code, 'Timeline unavailable')
      )

    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toEqual({ status })
  })

  it('does not return a valid prefix when the next request loses contact', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(page([SPOKEN], 'next-page'))
      .mockRejectedValueOnce(new Error('connection closed'))

    expect(await readCodexRealtimeTimeline({ request }, THREAD)).toEqual({ status: 'unknown' })
  })
})
