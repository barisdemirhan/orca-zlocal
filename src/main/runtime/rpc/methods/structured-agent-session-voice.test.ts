import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY } from '../../../../shared/agent-session-voice'
import { DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES } from '../../../ipc/desktop-renderer-runtime-capabilities'
import { ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES } from '../../../../shared/remote-runtime/protocol/electron-remote-runtime-client-capabilities'
import type { StructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/host/structured-agent-session-host'
import {
  call,
  clearStructuredHostStub,
  hostCalls,
  installStructuredHostStub
} from './structured-sessions/protocol/structured-agent-session-rpc.test-fixture'
import {
  envelope,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-sessions/protocol/structured-agent-session-rpc-client.test-fixture'

const OWNER = { voiceSessionId: 'voice-attempt-1', generation: 1 }
const SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
const CURRENT = {
  ...STRUCTURED_CLIENT,
  clientCapabilities: [
    ...STRUCTURED_CLIENT.clientCapabilities,
    AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY
  ]
}

beforeEach(() => {
  installStructuredHostStub()
  hostCalls.voiceCapability = vi.fn(async () => ({ supported: true, accountAccess: 'unchecked' }))
  hostCalls.startVoice = vi.fn(async () => ({ ok: true, value: { ...OWNER, state: 'connecting' } }))
  hostCalls.stopVoice = vi.fn(async () => ({ ok: true, value: { ...OWNER, state: 'off' } }))
  hostCalls.subscribeVoice = vi.fn(
    (input: Parameters<StructuredAgentSessionHost['voice']['subscribe']>[0]) => {
      input.emit({ ...OWNER, sessionId: SESSION, type: 'ready' })
      input.emit({ ...OWNER, sessionId: SESSION, type: 'sdp', sdp: SDP })
      return () => {}
    }
  )
  Reflect.set(hostCalls, 'voice', {
    capability: hostCalls.voiceCapability,
    start: hostCalls.startVoice,
    stop: hostCalls.stopVoice,
    subscribe: hostCalls.subscribeVoice
  })
})
afterEach(clearStructuredHostStub)

describe('native voice capability at the runtime RPC boundary', () => {
  it.each([
    ['agentSession.voiceCapability', { sessionId: SESSION }],
    ['agentSession.startVoice', { envelope: envelope(), ...OWNER, sdp: SDP }],
    ['agentSession.stopVoice', { envelope: envelope(), ...OWNER }],
    ['agentSession.subscribeVoice', { sessionId: SESSION, ...OWNER }]
  ] as const)(
    'refuses %s before handing an older client any voice operation or signalling',
    async (method, params) => {
      expect(await call(method, params, STRUCTURED_CLIENT)).toMatchObject({
        ok: false,
        error: { message: 'structured_agent_session_unsupported' }
      })
      expect(hostCalls.voiceCapability).not.toHaveBeenCalled()
      expect(hostCalls.startVoice).not.toHaveBeenCalled()
      expect(hostCalls.stopVoice).not.toHaveBeenCalled()
      expect(hostCalls.subscribeVoice).not.toHaveBeenCalled()
    }
  )

  it('refuses mobile voice signalling even when the mobile client advertises the new capability', async () => {
    expect(
      await call(
        'agentSession.subscribeVoice',
        { sessionId: SESSION, ...OWNER },
        { ...CURRENT, clientKind: 'mobile' }
      )
    ).toMatchObject({ ok: false, error: { message: 'structured_agent_session_unsupported' } })
    expect(hostCalls.subscribeVoice).not.toHaveBeenCalled()
  })

  it('explains paired desktop voice unavailability while still refusing start and signalling', async () => {
    const paired = { ...CURRENT, pairedDeviceId: 'paired-desktop' }
    expect(
      await call('agentSession.voiceCapability', { sessionId: SESSION }, paired)
    ).toMatchObject({
      ok: true,
      result: {
        supported: false,
        reason: 'Live voice is not available on paired devices. Open this conversation on the host.'
      }
    })
    for (const [method, params] of [
      ['agentSession.startVoice', { envelope: envelope(), ...OWNER, sdp: SDP }],
      ['agentSession.stopVoice', { envelope: envelope(), ...OWNER }],
      ['agentSession.subscribeVoice', { sessionId: SESSION, ...OWNER }]
    ] as const) {
      expect(await call(method, params, paired)).toMatchObject({
        ok: false,
        error: { message: 'structured_agent_session_unsupported' }
      })
    }
    expect(hostCalls.voiceCapability).not.toHaveBeenCalled()
    expect(hostCalls.startVoice).not.toHaveBeenCalled()
    expect(hostCalls.stopVoice).not.toHaveBeenCalled()
    expect(hostCalls.subscribeVoice).not.toHaveBeenCalled()
  })

  it('rejects a client-supplied connection identity instead of using it to address signalling', async () => {
    const reply = await call(
      'agentSession.subscribeVoice',
      {
        sessionId: SESSION,
        ...OWNER,
        connectionId: 'another-renderer-connection'
      },
      CURRENT
    )
    expect(reply.ok).toBe(false)
    expect(hostCalls.subscribeVoice).not.toHaveBeenCalled()
  })

  it.each([
    ['local desktop', DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES],
    ['remote desktop', ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES]
  ] as const)(
    'delivers live signalling through the existing %s subscription transport',
    async (_name, capabilities) => {
      expect(
        await call(
          'agentSession.voiceCapability',
          { sessionId: SESSION },
          { clientKind: 'runtime', clientCapabilities: [...capabilities] }
        )
      ).toMatchObject({ ok: true, result: { supported: true, accountAccess: 'unchecked' } })
      const reply = await call(
        'agentSession.subscribeVoice',
        { sessionId: SESSION, ...OWNER },
        { clientKind: 'runtime', clientCapabilities: [...capabilities] }
      )
      expect(reply).toMatchObject({
        ok: true,
        result: { ...OWNER, sessionId: SESSION, type: 'ready' }
      })
      expect(hostCalls.subscribeVoice).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    'not an SDP',
    'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
    `${SDP}\0`,
    `v=0\r\nm=audio ${'x'.repeat(128 * 1024)}`
  ])('rejects an invalid or oversized offer before the host sees it', async (sdp) => {
    const reply = await call(
      'agentSession.startVoice',
      { envelope: envelope(), ...OWNER, sdp },
      CURRENT
    )
    expect(reply.ok).toBe(false)
    expect(hostCalls.startVoice).not.toHaveBeenCalled()
  })
})
