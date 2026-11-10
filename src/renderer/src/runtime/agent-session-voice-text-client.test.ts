import { afterEach, expect, it, vi } from 'vitest'
import { AppendVoiceTextParams } from '../../../shared/rpc-contract/structured-agent-session-voice-params'
import { appendAgentSessionVoiceText } from './agent-session-voice-text-client'

const call = vi.hoisted(() => vi.fn())
vi.mock('./rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: call }))
afterEach(() => call.mockReset())

const owner = { voiceSessionId: '11111111-1111-4111-8111-111111111111', generation: 1 }
const sessionId = '22222222-2222-4222-8222-222222222222'

it('sends a serializable owner envelope when the live attempt also contains media and callbacks', async () => {
  const liveAttempt = { ...owner, media: { stop: () => {} }, ready: true }
  call.mockImplementationOnce(async (_target, _method, params) => {
    const wire = structuredClone(params)
    expect(AppendVoiceTextParams.safeParse(wire).success).toBe(true)
    expect(wire.text).toBe('Selected agent needs a decision')
    return { ok: true, value: { ...owner, applied: true } }
  })
  await expect(
    appendAgentSessionVoiceText(
      { kind: 'local' },
      sessionId,
      1,
      liveAttempt,
      ' Selected agent needs a decision '
    )
  ).resolves.toBe(true)
})

it('does not resend an uncertain context append', async () => {
  call.mockRejectedValueOnce(new Error('connection lost'))
  await expect(
    appendAgentSessionVoiceText({ kind: 'local' }, sessionId, 1, owner, 'Status update')
  ).resolves.toBe(false)
  expect(call).toHaveBeenCalledOnce()
})
