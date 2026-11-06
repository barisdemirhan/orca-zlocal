import { afterEach, describe, expect, it } from 'vitest'
import { CodexAppServerRequestError } from './app-server/codex-app-server-request-error'
import { CodexAppServerUnsupportedError } from './app-server/codex-app-server-session'
import {
  acquireReadyCodexForTest,
  adapterFor,
  fakeCodex,
  identityFor,
  THREAD_ID
} from './structured/session-lifecycle/codex-structured-session-adapter-fixture'
import type { CodexStructuredSessionAdapter } from './structured/session-lifecycle/codex-structured-session-adapter'
import type { CodexStructuredSessionEvent } from './structured/session-lifecycle/codex-structured-session-state'

const SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
const OWNER = { voiceSessionId: 'voice-attempt-1', generation: 1 }
const INPUT = { ...OWNER, sessionId: 'session-1', fence: 7, sdp: SDP }
const VOICES = {
  voices: { defaultV1: 'alloy', defaultV2: 'alloy', v1: ['alloy'], v2: ['alloy'], v3: ['alloy'] }
}
let adapter: CodexStructuredSessionAdapter | undefined
afterEach(async () => {
  await adapter?.closeAll()
})

async function setup(routes: Parameters<typeof fakeCodex>[0] = {}) {
  const codex = fakeCodex({
    'thread/realtime/listVoices': () => VOICES,
    'thread/timeline/list': () => ({ data: [], nextCursor: null }),
    ...routes
  })
  const events: CodexStructuredSessionEvent[] = []
  adapter = adapterFor(codex, {}, events)
  await acquireReadyCodexForTest(adapter, {
    identity: identityFor('session-1'),
    fence: 7,
    spawnToken: 'spawn-1'
  })
  const connection = codex.connections[0]
  if (!connection) {
    throw new Error('Expected the acquired provider connection')
  }
  return { adapter, codex, events, connection }
}

describe('Codex native realtime on a structured conversation', () => {
  it('appends selected context to the live acquired thread without starting a turn or replaying after close', async () => {
    const rig = await setup()
    const input = { ...INPUT, text: 'A selected agent needs a decision.' }
    expect(await rig.adapter.voice.appendText(input)).toBe(false)
    await rig.adapter.voice.start(INPUT)
    rig.connection.handlers.onNotification?.('thread/realtime/started', {
      threadId: THREAD_ID,
      realtimeSessionId: OWNER.voiceSessionId
    })
    expect(await rig.adapter.voice.appendText(input)).toBe(true)
    expect(await rig.adapter.voice.appendText({ ...input, generation: 2 })).toBe(false)
    await rig.adapter.voice.stop(INPUT)
    expect(await rig.adapter.voice.appendText(input)).toBe(false)
    expect(
      rig.connection.calls.filter((call) => call.method === 'thread/realtime/appendText')
    ).toMatchObject([{ params: { threadId: THREAD_ID, role: 'user', text: input.text } }])
    expect(rig.connection.calls.filter((call) => call.method === 'turn/start')).toHaveLength(0)
  })
  it('keeps the acquired conversation usable for Live when Codex 0.163 has not implemented timeline/list', async () => {
    const rig = await setup({
      'thread/timeline/list': () => {
        throw new CodexAppServerUnsupportedError('thread/timeline/list is not supported yet')
      }
    })
    const openedThreads = rig.connection.calls.filter(
      (call) => call.method === 'thread/start'
    ).length
    expect(await rig.adapter.voice.start(INPUT)).toEqual({
      ok: true,
      value: { ...OWNER, state: 'connecting' }
    })
    expect(
      rig.connection.calls.filter((call) => call.method === 'thread/realtime/start')
    ).toMatchObject([{ params: { threadId: THREAD_ID } }])
    expect(rig.codex.connections).toHaveLength(1)
    expect(rig.connection.calls.filter((call) => call.method === 'thread/start')).toHaveLength(
      openedThreads
    )
  })

  it('starts and stops voice on the acquired thread without another connection, seed or turn interrupt', async () => {
    const rig = await setup()
    rig.codex.routes['thread/realtime/start'] = () => {
      rig.connection.handlers.onNotification?.('thread/realtime/started', {
        threadId: THREAD_ID,
        realtimeSessionId: OWNER.voiceSessionId,
        version: 'v3'
      })
      rig.connection.handlers.onNotification?.('thread/realtime/sdp', {
        threadId: THREAD_ID,
        sdp: SDP
      })
      return {}
    }
    expect(await rig.adapter.voice.start(INPUT)).toEqual({
      ok: true,
      value: { ...OWNER, state: 'connecting' }
    })
    const start = rig.connection.calls.find((call) => call.method === 'thread/realtime/start')
    expect(start?.params).toEqual({
      threadId: THREAD_ID,
      realtimeSessionId: OWNER.voiceSessionId,
      outputModality: 'audio',
      transport: { type: 'webrtc', sdp: SDP },
      version: 'v3'
    })
    expect(
      rig.events.filter((event) => event.type === 'voice').map((event) => event.event.type)
    ).toEqual(['started', 'sdp'])
    expect(await rig.adapter.voice.stop(INPUT)).toEqual({ ...OWNER, state: 'off' })
    expect(rig.adapter.voice.holds('session-1')).toBe(false)
    expect(
      rig.events.filter((event) => event.type === 'voice' && event.event.type === 'closed')
    ).toHaveLength(1)
    expect(rig.codex.connections).toHaveLength(1)
    expect(
      rig.connection.calls
        .filter((call) => /^(thread\/start|turn\/start|turn\/interrupt)$/.test(call.method))
        .map((call) => call.method)
    ).toEqual(['thread/start'])
    expect(rig.connection.closeCount).toBe(0)
  })

  it('retries once without a realtime version when Codex does not know v3', async () => {
    const rig = await setup()
    rig.codex.routes['thread/realtime/start'] = (params) => {
      if (params?.version === 'v3') {
        throw new CodexAppServerRequestError(
          'thread/realtime/start',
          -32600,
          'codex app-server thread/realtime/start failed: Invalid request: unknown variant `v3`, expected `v1` or `v2`'
        )
      }
      return {}
    }
    expect(await rig.adapter.voice.start(INPUT)).toEqual({
      ok: true,
      value: { ...OWNER, state: 'connecting' }
    })
    expect(
      rig.connection.calls
        .filter((call) => call.method === 'thread/realtime/start')
        .map((call) => call.params?.version ?? null)
    ).toEqual(['v3', null])
  })

  it('keeps an ambiguous start and stop owned, refuses overlap, and accepts closure without replay', async () => {
    const rig = await setup({
      'thread/realtime/start': () => {
        throw new Error('timed out')
      },
      'thread/realtime/stop': () => {
        throw new Error('transport lost')
      }
    })
    await expect(rig.adapter.voice.start(INPUT)).rejects.toThrow('could not connect')
    expect(rig.adapter.voice.holds('session-1')).toBe(true)
    expect(await rig.adapter.voice.stop(INPUT)).toEqual({ ...OWNER, state: 'unverifiable' })
    expect(
      await rig.adapter.voice.start({ ...INPUT, voiceSessionId: 'another-attempt', generation: 2 })
    ).toMatchObject({ ok: false })
    expect(
      rig.connection.calls.filter((call) => call.method === 'thread/realtime/start')
    ).toHaveLength(1)
    rig.connection.handlers.onNotification?.('thread/realtime/closed', { threadId: THREAD_ID })
    expect(rig.adapter.voice.holds('session-1')).toBe(false)
    expect(await rig.adapter.voice.start(INPUT)).toMatchObject({ ok: false })
    expect(
      rig.connection.calls.filter((call) => call.method === 'thread/realtime/start')
    ).toHaveLength(1)
  })

  it('does not publish or stop a newer voice from an older fence, child, or attempt', async () => {
    const rig = await setup()
    await rig.adapter.voice.start(INPUT)
    expect(await rig.adapter.voice.stop({ ...INPUT, voiceSessionId: 'old-voice' })).toMatchObject({
      state: 'off'
    })
    expect(rig.connection.calls.some((call) => call.method === 'thread/realtime/stop')).toBe(false)
    await acquireReadyCodexForTest(rig.adapter, {
      identity: identityFor('session-1'),
      fence: 8,
      spawnToken: 'spawn-2'
    })
    const second = rig.codex.connections[1]
    if (!second) {
      throw new Error('Expected the replacement provider connection')
    }
    await rig.adapter.voice.start({
      ...INPUT,
      fence: 8,
      generation: 2,
      voiceSessionId: 'voice-attempt-2'
    })
    const before = rig.events.filter((event) => event.type === 'voice').length
    rig.connection.handlers.onNotification?.('thread/realtime/started', {
      threadId: THREAD_ID,
      realtimeSessionId: OWNER.voiceSessionId,
      version: 'v3'
    })
    rig.connection.handlers.onNotification?.('thread/realtime/sdp', {
      threadId: THREAD_ID,
      sdp: SDP
    })
    rig.connection.handlers.onNotification?.('thread/realtime/closed', { threadId: THREAD_ID })
    second.handlers.onNotification?.('thread/realtime/started', {
      threadId: THREAD_ID,
      realtimeSessionId: OWNER.voiceSessionId,
      version: 'v3'
    })
    second.handlers.onNotification?.('thread/realtime/sdp', { threadId: THREAD_ID, sdp: SDP })
    expect(rig.events.filter((event) => event.type === 'voice')).toHaveLength(before)
    expect(rig.adapter.voice.holds('session-1')).toBe(true)
    expect(await rig.adapter.voice.start(INPUT)).toMatchObject({ ok: false })
  })

  it('distinguishes native unsupported from an unknown probe and never starts audio from either', async () => {
    const rig = await setup({
      'thread/realtime/listVoices': () => {
        throw new CodexAppServerUnsupportedError('method missing')
      }
    })
    expect(await rig.adapter.voice.capability('session-1')).toMatchObject({ supported: false })
    expect(await rig.adapter.voice.start(INPUT)).toMatchObject({ ok: false })
    expect(rig.connection.calls.some((call) => call.method === 'thread/realtime/start')).toBe(false)
    expect(await rig.adapter.voice.capability('at-rest')).toMatchObject({ supported: null })
    await acquireReadyCodexForTest(rig.adapter, {
      identity: identityFor('session-1'),
      fence: 8,
      spawnToken: 'spawn-2'
    })
    rig.codex.routes['thread/realtime/listVoices'] = () => {
      throw new Error('timed out')
    }
    expect(await rig.adapter.voice.capability('session-1')).toMatchObject({ supported: null })
    rig.codex.routes['thread/realtime/listVoices'] = () => VOICES
    expect(await rig.adapter.voice.capability('session-1')).toEqual({
      supported: true,
      accountAccess: 'unchecked'
    })
    expect(rig.codex.connections).toHaveLength(2)
  })

  it.each(['entries', 'bytes'] as const)(
    'asks for a new Orb conversation when Live history exceeds the %s limit',
    async (limit) => {
      let offset = 0
      const rig = await setup({
        'thread/timeline/list': () => {
          const data = Array.from({ length: limit === 'entries' ? 50 : 1 }, () => ({
            type: 'item',
            position: offset++,
            turnId: 'turn-1',
            item: {
              id: `item-${offset}`,
              type: 'agentMessage',
              text: limit === 'bytes' ? 'x'.repeat(16 * 1024 * 1024) : 'History'
            }
          }))
          return { data, nextCursor: limit === 'entries' ? `page-${offset}` : null }
        }
      })
      expect(await rig.adapter.voice.start(INPUT)).toEqual({
        ok: false,
        rejected: 'This conversation is too long for Live voice. Start a new Orb conversation.'
      })
      expect(rig.connection.calls.some((call) => call.method === 'thread/realtime/start')).toBe(
        false
      )
    }
  )

  it('publishes only safe current transcript activity and sanitizes a native account refusal', async () => {
    const rig = await setup()
    await rig.adapter.voice.start(INPUT)
    const notify = rig.connection.handlers.onNotification
    notify?.('thread/realtime/started', {
      threadId: THREAD_ID,
      realtimeSessionId: OWNER.voiceSessionId,
      version: 'v3'
    })
    notify?.('thread/realtime/item/started', {
      threadId: THREAD_ID,
      item: {
        id: 'spoken-user',
        realtimeSessionId: OWNER.voiceSessionId,
        type: 'transcriptSegment',
        role: 'user',
        text: ''
      }
    })
    notify?.('thread/realtime/item/transcript/delta', {
      threadId: THREAD_ID,
      itemId: 'spoken-user',
      delta: 'private partial'
    })
    notify?.('thread/realtime/item/transcript/delta', {
      threadId: THREAD_ID,
      itemId: 'old-item',
      delta: 'stale partial'
    })
    notify?.('thread/realtime/outputAudio/delta', { threadId: THREAD_ID, audio: 'private-pcm' })
    const projected = rig.events
      .filter((event) => event.type === 'voice')
      .map((event) => event.event)
    expect(projected.filter((event) => event.type === 'transcript')).toEqual([
      {
        type: 'transcript',
        sessionId: 'session-1',
        ...OWNER,
        role: 'user',
        phase: 'started',
        itemId: 'spoken-user',
        hasText: false
      },
      {
        type: 'transcript',
        sessionId: 'session-1',
        ...OWNER,
        role: 'user',
        phase: 'delta',
        itemId: 'spoken-user',
        hasText: true
      }
    ])
    expect(JSON.stringify(rig.events)).not.toMatch(/private partial|stale partial|private-pcm/)
    notify?.('thread/realtime/closed', { threadId: THREAD_ID })
    rig.codex.routes['thread/realtime/start'] = () => {
      throw new CodexAppServerRequestError('thread/realtime/start', -32600, `account quota ${SDP}`)
    }
    const refused = await rig.adapter.voice.start({
      ...INPUT,
      voiceSessionId: 'voice-attempt-2',
      generation: 2
    })
    expect(refused).toMatchObject({ ok: false, rejected: expect.stringContaining('usage limit') })
    expect(JSON.stringify(refused)).not.toContain(SDP)
  })
})
