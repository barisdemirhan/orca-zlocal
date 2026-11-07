import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentJournalRenderItemSchema } from '../../shared/agent-session/journal/agent-session-journal-schemas'
import { codexProviderHandle } from '../../shared/agent-session/lifecycle/agent-session-provider-handle-encoding'
import { projectStructuredItemsToNativeChat } from '../../shared/agent-session/view/structured-agent-session-projection'
import {
  closeTestJournalHostDatabase,
  createTrackedJournalOpener,
  type TestJournalOptions
} from '../native-chat/agent-session-journal/store-lifecycle/journal-host-database-test-support'
import { createDeferredStructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/journal-ingress/structured-agent-session-event-sink'
import { testEventSinkLogging } from '../native-chat/agent-session-wire/host/testing/structured-agent-session-logger-test-support'
import { createCodexJournalTranslator } from './structured/journal/codex-structured-journal-translation'
import type { CodexTimelineEntry } from './codex-structured-realtime-timeline'

const SESSION = 'session-native-voice'
const THREAD = 'thread-native-voice'
const TURN = 'turn-1'

// Native 0.163.0 ThreadRealtimeItemCompletedNotification payloads.
const USER_FINAL = {
  type: 'transcriptSegment',
  id: 'spoken-user-1',
  realtimeSessionId: 'voice-1',
  role: 'user',
  text: 'List the current changes.'
} as const
const ASSISTANT_FINAL = {
  type: 'transcriptSegment',
  id: 'spoken-assistant-1',
  realtimeSessionId: 'voice-1',
  role: 'assistant',
  text: 'The changes are ready.'
} as const

const journals = createTrackedJournalOpener()
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup()
  }
})

async function conversation() {
  const root = await mkdtemp(join(tmpdir(), 'orca-codex-voice-journal-'))
  const options = {
    identity: {
      sessionId: SESSION,
      workspaceId: 'folder-workspace',
      hostId: 'local',
      agent: 'codex',
      providerHandle: codexProviderHandle(THREAD)
    },
    stateDirectory: root,
    now: () => 1_000
  } satisfies TestJournalOptions
  let journal = await journals.open(options)
  const initialCursor = journal.cursor()
  const deferred = createDeferredStructuredAgentSessionEventSink(testEventSinkLogging(SESSION))
  deferred.bind({ journal, fence: 1, publish: () => {} })
  let translator = createCodexJournalTranslator({
    sink: deferred.sink,
    sessionId: SESSION,
    primaryThreadId: () => THREAD
  })
  cleanups.push(async () => {
    translator.dispose()
    await deferred.drained()
    deferred.close()
    await journals.closeAll()
    await rm(root, { recursive: true, force: true })
  })
  return {
    notify: (method: string, params: Record<string, unknown>, threadId = THREAD) =>
      translator.handle({
        type: 'notification',
        sessionId: SESSION,
        threadId,
        method,
        params: { threadId, ...params }
      }),
    restore: (entries: readonly CodexTimelineEntry[], realtimeOnly = false) => {
      if (!translator.restoreTimeline) {
        throw new Error('Canonical timeline restore is unavailable')
      }
      return translator.restoreTimeline(THREAD, entries, realtimeOnly)
    },
    snapshot: async () => {
      expect(await deferred.drained()).toEqual({ ok: true })
      return journal.snapshot()
    },
    rows: async () => {
      expect(await deferred.drained()).toEqual({ ok: true })
      return journal.readSince(initialCursor)
    },
    reopen: async () => {
      translator.dispose()
      await deferred.drained()
      deferred.unbind()
      await journal.close()
      await closeTestJournalHostDatabase(root)
      journal = await journals.open(options)
      deferred.bind({ journal, fence: 2, publish: () => {} })
      translator = createCodexJournalTranslator({
        sink: deferred.sink,
        sessionId: SESSION,
        primaryThreadId: () => THREAD
      })
    }
  }
}

function realtime(
  item: Extract<CodexTimelineEntry, { type: 'realtime' }>['item'],
  position: number
): CodexTimelineEntry {
  return { type: 'realtime', position, item }
}

describe('Codex canonical spoken messages in the real journal', () => {
  it('keeps one stable message per native item through duplicates, disk reopen and timeline replay', async () => {
    const chat = await conversation()
    expect(chat.notify('thread/realtime/item/completed', { item: USER_FINAL })).toEqual({
      accepted: true
    })
    expect(chat.notify('thread/realtime/item/completed', { item: ASSISTANT_FINAL })).toEqual({
      accepted: true
    })
    const first = await chat.snapshot()
    const firstRows = await chat.rows()
    expect(first.items).toHaveLength(2)

    chat.notify('thread/realtime/item/completed', { item: USER_FINAL })
    chat.notify('thread/realtime/item/completed', { item: ASSISTANT_FINAL })
    await chat.reopen()
    expect(chat.restore([realtime(USER_FINAL, 0), realtime(ASSISTANT_FINAL, 1)], true)).toEqual({
      accepted: true
    })
    const restored = await chat.snapshot()

    expect(await chat.rows()).toEqual(firstRows)
    expect(restored.items).toEqual(first.items)
    expect(restored.items.map((item) => AgentJournalRenderItemSchema.parse(item).body)).toEqual([
      {
        kind: 'message',
        role: 'user',
        blocks: [{ type: 'text', text: 'List the current changes.' }],
        spoken: {
          provider: 'codex',
          threadId: THREAD,
          realtimeSessionId: 'voice-1',
          itemId: 'spoken-user-1'
        }
      },
      {
        kind: 'message',
        role: 'assistant',
        blocks: [{ type: 'text', text: 'The changes are ready.' }],
        spoken: {
          provider: 'codex',
          threadId: THREAD,
          realtimeSessionId: 'voice-1',
          itemId: 'spoken-assistant-1'
        }
      }
    ])
    expect(restored.items.map((item) => item.turnScope)).toEqual([
      { kind: 'thread' },
      { kind: 'thread' }
    ])
    await chat.reopen()
    const reopened = await chat.snapshot()
    expect(reopened.items).toEqual(restored.items)
    expect(
      projectStructuredItemsToNativeChat(reopened.items).map((message) => message.spoken)
    ).toEqual([
      {
        provider: 'codex',
        threadId: THREAD,
        realtimeSessionId: 'voice-1',
        itemId: 'spoken-user-1'
      },
      {
        provider: 'codex',
        threadId: THREAD,
        realtimeSessionId: 'voice-1',
        itemId: 'spoken-assistant-1'
      }
    ])
  })

  it('keeps a late canonical final from a closed voice attempt without journaling a new voice start', async () => {
    const chat = await conversation()
    chat.notify('thread/realtime/closed', { reason: 'requested' })
    chat.notify('thread/realtime/started', {
      realtimeSessionId: 'voice-2',
      sessionId: 'native-session-2'
    })
    chat.notify('thread/realtime/item/completed', { item: ASSISTANT_FINAL })
    chat.notify('thread/realtime/item/completed', { item: ASSISTANT_FINAL })
    const first = await chat.snapshot()

    expect(first.items).toHaveLength(1)
    expect(first.items[0]?.body).toMatchObject({
      kind: 'message',
      blocks: [{ type: 'text', text: 'The changes are ready.' }],
      spoken: { realtimeSessionId: 'voice-1', itemId: 'spoken-assistant-1' }
    })
    await chat.reopen()
    chat.restore([realtime(ASSISTANT_FINAL, 0)], true)
    expect((await chat.snapshot()).items.map((item) => item.itemId)).toEqual(
      first.items.map((item) => item.itemId)
    )
  })

  it('does not create another task or message when voice promotes an existing ordinary item', async () => {
    const chat = await conversation()
    chat.notify('item/completed', {
      turnId: TURN,
      item: { type: 'agentMessage', id: 'ordinary-answer', text: 'Existing answer' }
    })
    const ordinary = await chat.snapshot()
    const promotion = {
      id: 'promotion-1',
      realtimeSessionId: 'voice-1',
      type: 'bemItemPromoted',
      turn_id: TURN,
      item_id: 'ordinary-answer',
      presentation: { type: 'wholeItem' }
    } satisfies Extract<CodexTimelineEntry, { type: 'realtime' }>['item']
    chat.notify('thread/realtime/item/completed', { item: promotion })
    chat.restore([realtime(promotion, 0)], true)

    expect(ordinary.items).toHaveLength(1)
    expect((await chat.snapshot()).items).toEqual(ordinary.items)
  })

  it('never persists SDP, audio, draft transcripts or legacy transcript finals', async () => {
    const chat = await conversation()
    const empty = await chat.snapshot()
    const transient: [string, Record<string, unknown>][] = [
      [
        'thread/realtime/sdp',
        { sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=ice-pwd:private-sdp' }
      ],
      [
        'thread/realtime/outputAudio/delta',
        { audio: { data: 'private-pcm', numChannels: 1, sampleRate: 24_000 } }
      ],
      ['thread/realtime/item/started', { item: { ...USER_FINAL, text: 'draft transcript' } }],
      [
        'thread/realtime/item/transcript/delta',
        { itemId: USER_FINAL.id, delta: 'partial transcript' }
      ],
      [
        'thread/realtime/transcript/done',
        { role: 'assistant', text: 'legacy final without canonical identity' }
      ],
      ['thread/realtime/item/completed', { item: { ...USER_FINAL, text: '   ' } }]
    ]
    for (const [method, params] of transient) {
      expect(chat.notify(method, params)).toEqual({ accepted: true })
    }
    expect(await chat.snapshot()).toEqual(empty)

    chat.notify('thread/realtime/item/completed', {
      item: { ...USER_FINAL, sdp: 'private-sdp', audio: 'private-pcm', partial: 'private-draft' }
    })
    const written = await chat.rows()
    expect(written.ok).toBe(true)
    if (!written.ok) {
      throw new Error('Journal rows could not be read')
    }
    expect(written.rows).toHaveLength(1)
    const saved = JSON.stringify([written.rows, await chat.snapshot()])
    expect(saved).toContain('List the current changes.')
    for (const privateValue of [
      'private-sdp',
      'private-pcm',
      'private-draft',
      'partial transcript',
      'legacy final'
    ]) {
      expect(saved).not.toContain(privateValue)
    }
    await chat.reopen()
    expect((await chat.snapshot()).items).toHaveLength(1)
  })

  it('restores ordinary and spoken messages in canonical rollout order', async () => {
    const chat = await conversation()
    const timeline: CodexTimelineEntry[] = [
      { type: 'turnStarted', position: 0, turn_id: TURN, started_at: 1_700_000_000 },
      {
        type: 'item',
        position: 1,
        turnId: TURN,
        item: {
          type: 'userMessage',
          id: 'typed-user',
          content: [{ type: 'text', text: 'Typed request' }]
        }
      },
      realtime(USER_FINAL, 2),
      {
        type: 'item',
        position: 3,
        turnId: TURN,
        item: { type: 'agentMessage', id: 'typed-answer', text: 'Typed answer' }
      },
      realtime(ASSISTANT_FINAL, 4),
      {
        type: 'turnCompleted',
        position: 5,
        turn_id: TURN,
        status: 'completed',
        started_at: 1_700_000_000,
        completed_at: 1_700_000_002,
        duration_ms: 2_000
      }
    ]
    expect(chat.restore(timeline)).toEqual({ accepted: true })
    const restored = await chat.snapshot()
    expect(
      restored.items.filter((item) => item.body.kind === 'message').map((item) => item.body)
    ).toMatchObject([
      { role: 'user', blocks: [{ type: 'text', text: 'Typed request' }] },
      { role: 'user', blocks: [{ type: 'text', text: 'List the current changes.' }] },
      { role: 'assistant', blocks: [{ type: 'text', text: 'Typed answer' }] },
      { role: 'assistant', blocks: [{ type: 'text', text: 'The changes are ready.' }] }
    ])
    expect(
      restored.items.filter((item) => item.body.kind === 'turn').map((item) => item.body)
    ).toMatchObject([
      {
        turnId: TURN,
        state: 'completed',
        startedAt: 1_700_000_000_000,
        completedAt: 1_700_000_002_000,
        durationMs: 2_000
      }
    ])
    await chat.reopen()
    expect((await chat.snapshot()).items).toEqual(restored.items)
  })
})
