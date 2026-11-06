import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCodexAppServerRecordDispatcher } from './app-server/codex-app-server-record-dispatch'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('native voice diagnostics at the provider frame boundary', () => {
  it('logs an expired realtime request without retaining its private error payload', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onUnhandledFrame = vi.fn()
    const dispatcher = createCodexAppServerRecordDispatcher({
      handlers: { onUnhandledFrame },
      writeResponse: vi.fn(),
      onProtocolFailure: vi.fn()
    })
    const timer = setTimeout(() => {}, 50)
    clearTimeout(timer)
    dispatcher.addPending(1, {
      method: 'thread/realtime/start',
      timer,
      resolve: vi.fn(),
      reject: vi.fn()
    })
    dispatcher.timeOutPending(1)
    const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
    dispatcher.dispatch({ id: 1, error: { message: `Provider rejected signalling: ${sdp}` } })
    expect(warn.mock.calls).toEqual([
      ['[codex-app-server] late reply to thread/realtime/start after timeout (id 1)']
    ])
    expect(onUnhandledFrame).not.toHaveBeenCalled()
  })
})
