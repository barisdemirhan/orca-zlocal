import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionVoiceEvent } from '../../shared/agent-session-voice'
import type { CodexAppServerConnection } from './app-server/codex-app-server-connection-types'
import { CodexStructuredRealtime } from './codex-structured-realtime'

const SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
const OWNER = { voiceSessionId: 'voice-1', generation: 1 }
const NEXT = { voiceSessionId: 'voice-2', generation: 2, sdp: SDP }
const TIMEOUT_MS = 25

function setup() {
  const request = vi.fn<CodexAppServerConnection['request']>(async (method) =>
    method === 'thread/realtime/listVoices'
      ? {
          voices: { defaultV1: 'alloy', defaultV2: 'alloy', v1: ['alloy'], v2: ['alloy'] }
        }
      : {}
  )
  const events: AgentSessionVoiceEvent[] = []
  const realtime = new CodexStructuredRealtime(
    { request },
    'session-1',
    'thread-1',
    (event) => events.push(event),
    TIMEOUT_MS
  )
  return { request, events, realtime }
}

describe('Codex Live recovery on the existing provider connection', () => {
  it.each(['start transport failure', 'native error notification'])(
    'cleans up %s before admitting another attempt',
    async (failure) => {
      const { request, events, realtime } = setup()
      if (failure === 'start transport failure') {
        request.mockResolvedValueOnce({
          voices: { defaultV1: 'alloy', defaultV2: 'alloy', v1: ['alloy'], v2: ['alloy'] }
        })
        request.mockRejectedValueOnce(new Error('transport timed out'))
        await expect(realtime.start({ ...OWNER, sdp: SDP })).rejects.toThrow('could not connect')
      } else {
        await realtime.start({ ...OWNER, sdp: SDP })
        realtime.observe('thread/realtime/error', { threadId: 'thread-1', message: 'quota' })
      }
      expect(realtime.holdsWork).toBe(true)
      expect(await realtime.start(NEXT)).toEqual({
        ok: true,
        value: {
          voiceSessionId: NEXT.voiceSessionId,
          generation: NEXT.generation,
          state: 'connecting'
        }
      })
      expect(
        request.mock.calls.filter(([method]) => method !== 'thread/realtime/listVoices')
      ).toEqual([
        ['thread/realtime/start', expect.any(Object), { timeoutMs: TIMEOUT_MS }],
        ['thread/realtime/stop', { threadId: 'thread-1' }, { timeoutMs: TIMEOUT_MS }],
        ['thread/realtime/start', expect.any(Object), { timeoutMs: TIMEOUT_MS }]
      ])
      expect(events.filter((event) => event.type === 'closed')).toEqual([
        { sessionId: 'session-1', ...OWNER, type: 'closed', reason: 'Codex Live voice closed.' }
      ])
      expect(realtime.holdsWork).toBe(true)
      await realtime.stop(NEXT)
      expect(realtime.holdsWork).toBe(false)
    }
  )

  it('keeps a failed cleanup unverifiable and retries it on the next start', async () => {
    const { request, realtime } = setup()
    await realtime.start({ ...OWNER, sdp: SDP })
    realtime.observe('thread/realtime/error', { threadId: 'thread-1', message: 'connection lost' })
    request.mockRejectedValueOnce(new Error('stop timed out'))
    expect(await realtime.start(NEXT)).toEqual({
      ok: false,
      rejected: 'Codex Live voice is still closing. Try again shortly.'
    })
    expect(realtime.holdsWork).toBe(true)
    expect(
      request.mock.calls.filter(([method]) => method === 'thread/realtime/start')
    ).toHaveLength(1)
    expect(await realtime.start(NEXT)).toMatchObject({ ok: true })
    expect(request.mock.calls.filter(([method]) => method === 'thread/realtime/stop')).toHaveLength(
      2
    )
  })

  it('does not replace a healthy attempt or clear ownership when stop loses contact', async () => {
    const { request, events, realtime } = setup()
    await realtime.start({ ...OWNER, sdp: SDP })
    expect(await realtime.start(NEXT)).toMatchObject({ ok: false })
    expect(request.mock.calls.some(([method]) => method === 'thread/realtime/stop')).toBe(false)
    request.mockRejectedValueOnce(new Error('connection lost'))
    expect(await realtime.stop(OWNER)).toEqual({ ...OWNER, state: 'unverifiable' })
    expect(realtime.holdsWork).toBe(true)
    expect(events.some((event) => event.type === 'closed')).toBe(false)
    await realtime.stop(OWNER)
    realtime.observe('thread/realtime/closed', { threadId: 'thread-1' })
    expect(realtime.holdsWork).toBe(false)
    expect(events.filter((event) => event.type === 'closed')).toHaveLength(1)
  })

  it('admits fresh attempts beyond the replay window and evicts only the oldest identities', async () => {
    const { realtime } = setup()
    for (let generation = 1; generation <= 1025; generation += 1) {
      const owner = { voiceSessionId: `voice-${generation}`, generation }
      expect(await realtime.start({ ...owner, sdp: SDP })).toMatchObject({ ok: true })
      realtime.observe('thread/realtime/closed', { threadId: 'thread-1' })
    }
    expect(
      await realtime.start({ voiceSessionId: 'voice-2', generation: 1026, sdp: SDP })
    ).toMatchObject({ ok: false, rejected: expect.stringContaining('cannot be replayed') })
    expect(await realtime.start({ ...OWNER, generation: 1027, sdp: SDP })).toMatchObject({
      ok: true
    })
  })
})
