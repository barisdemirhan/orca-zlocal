// @vitest-environment happy-dom
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  AgentSessionVoiceEvent,
  AgentSessionVoiceOwner
} from '../../../../shared/agent-session-voice'
import type { AgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import {
  acquireMicrophoneCaptureLease,
  microphoneCaptureIsBusy
} from '../dictation/microphone-capture-lease'
import { AgentHubOrbVoiceController } from './agent-hub-orb-voice-controller'
import { MicrophoneCaptureSession } from '../dictation/microphone-capture-session'

class Track extends EventTarget {
  enabled = true
  stop = vi.fn()
}
class Peer extends EventTarget {
  static instances: Peer[] = []
  connectionState = 'new'
  iceGatheringState = 'complete'
  localDescription: RTCSessionDescriptionInit | null = null
  onconnectionstatechange: (() => void) | null = null
  ontrack: ((event: RTCTrackEvent) => void) | null = null
  channel: {
    readyState: string
    onopen: (() => void) | null
    onclose: (() => void) | null
    close: () => void
  } = {
    readyState: 'connecting',
    onopen: null,
    onclose: null,
    close: vi.fn(() => {
      this.channel.readyState = 'closed'
      this.channel.onclose?.()
    })
  }
  createDataChannel = vi.fn(() => this.channel)
  addTrack = vi.fn()
  createOffer = vi.fn(async () => ({
    type: 'offer' as const,
    sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
  }))
  setLocalDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.localDescription = description
  })
  setRemoteDescription = vi.fn(async () => undefined)
  close = vi.fn(() => {
    this.connectionState = 'closed'
    this.onconnectionstatechange?.()
  })
  constructor() {
    super()
    Peer.instances.push(this)
  }
  connect(): void {
    this.connectionState = 'connected'
    this.onconnectionstatechange?.()
    this.channel.readyState = 'open'
    this.channel.onopen?.()
  }
}

let track: Track
let controller: AgentHubOrbVoiceController
let client: AgentSessionVoiceClient
let voiceOwner: AgentSessionVoiceOwner | undefined
let receive: ((event: AgentSessionVoiceEvent) => void) | undefined
let unsubscribe: () => void

function streamFor(input: Track): MediaStream {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the media boundary only reads these two track collections in this fixture.
  return { getTracks: () => [input], getAudioTracks: () => [input] } as unknown as MediaStream
}
function event(
  payload:
    | { type: 'ready' }
    | { type: 'started' }
    | { type: 'closed'; reason?: string }
    | { type: 'sdp'; sdp: string }
): void {
  if (!voiceOwner || !receive) {
    throw new Error('Voice subscription is not open')
  }
  if (payload.type === 'closed') {
    receive({
      ...voiceOwner,
      sessionId: 'session',
      type: 'closed',
      reason: payload.reason ?? 'stopped'
    })
  } else {
    receive({ ...voiceOwner, sessionId: 'session', ...payload })
  }
}
async function start(): Promise<void> {
  const starting = controller.startLive()
  await waitFor(() => expect(voiceOwner).toBeDefined())
  event({ type: 'ready' })
  await starting
}

beforeEach(() => {
  Peer.instances = []
  track = new Track()
  voiceOwner = undefined
  receive = undefined
  unsubscribe = vi.fn<() => void>()
  vi.stubGlobal('RTCPeerConnection', Peer)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(async () => streamFor(track)) },
    locks: {
      request: vi.fn(
        async (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) =>
          callback({})
      )
    }
  })
  client = {
    capability: vi.fn(async () => ({
      supported: true as const,
      accountAccess: 'unchecked' as const
    })),
    subscribe: vi.fn<AgentSessionVoiceClient['subscribe']>(async (owner, onEvent) => {
      voiceOwner = owner
      receive = onEvent
      return { unsubscribe }
    }),
    start: vi.fn(async (owner) => ({ ...owner, state: 'connecting' as const })),
    stop: vi.fn(async (owner) => ({ ...owner, state: 'off' as const }))
  }
  controller = new AgentHubOrbVoiceController(
    { sessionId: 'session', tabId: 'tab', hostKey: 'local', agent: 'codex' },
    client,
    () => ({})
  )
  controller.setHostCapability('supported')
})
afterEach(async () => {
  await controller.stopLive()
  vi.unstubAllGlobals()
})

it('starts only after the click and stream ready, and reports live only after native start, SDP and peer readiness', async () => {
  await Promise.resolve()
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  const starting = controller.startLive()
  await waitFor(() => expect(voiceOwner).toBeDefined())
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  event({ type: 'ready' })
  await starting
  const peer = Peer.instances[0]
  peer?.connect()
  event({ type: 'started' })
  expect(controller.getSnapshot().connection).toBe('connecting')
  event({ type: 'sdp', sdp: 'fixture answer' })
  await waitFor(() => expect(controller.getSnapshot().connection).toBe('live'))
  controller.muteInput(true)
  expect(track.enabled).toBe(false)
  expect(controller.getSnapshot().connection).toBe('live')
  expect(client.stop).not.toHaveBeenCalled()
  controller.muteInput(false)
  expect(track.enabled).toBe(true)
  await controller.switchToText()
  expect(track.stop).toHaveBeenCalledOnce()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(controller.getSnapshot()).toMatchObject({
    connection: 'off',
    textMode: true,
    output: 'silent'
  })
})

it('keeps a pending permission request leased until the late stream is stopped', async () => {
  let resolveCapture: ((stream: MediaStream) => void) | undefined
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCapture = resolve
      })
  )
  const starting = controller.startLive()
  await waitFor(() => expect(voiceOwner).toBeDefined())
  event({ type: 'ready' })
  await waitFor(() => expect(resolveCapture).toBeDefined())
  const stopping = controller.stopLive()
  expect(microphoneCaptureIsBusy()).toBe(true)
  let readyForDictation = false
  const preparing = controller.prepareDictation().then((ready) => {
    readyForDictation = ready
  })
  await Promise.resolve()
  expect(readyForDictation).toBe(false)
  resolveCapture?.(streamFor(track))
  await Promise.all([starting, stopping, preparing])
  expect(track.stop).toHaveBeenCalledOnce()
  expect(microphoneCaptureIsBusy()).toBe(false)
  expect(readyForDictation).toBe(true)
  expect(client.start).not.toHaveBeenCalled()
})

it('turns local media off before an unverified stop and reconciles before a new start', async () => {
  await start()
  vi.mocked(client.stop).mockImplementationOnce(async (owner) => ({
    ...owner,
    state: 'unverifiable'
  }))
  const stopping = controller.stopLive()
  expect(track.stop).toHaveBeenCalledOnce()
  await stopping
  expect(controller.getSnapshot()).toMatchObject({ connection: 'error', input: 'muted' })
  expect(await controller.prepareDictation()).toBe(true)
  expect(client.stop).toHaveBeenCalledTimes(2)
  expect(controller.getSnapshot().connection).toBe('off')
})

it('rejects another recording, unknown hosts and an existing non-Codex conversation without touching capture', async () => {
  const release = await acquireMicrophoneCaptureLease()
  try {
    await controller.startLive()
    expect(controller.getSnapshot().reason).toContain('already in use')
  } finally {
    await release()
  }
  controller.setHostCapability('unknown')
  await controller.startLive()
  expect(client.subscribe).not.toHaveBeenCalled()
  controller = new AgentHubOrbVoiceController(
    { sessionId: 'claude-history', tabId: 'tab', hostKey: 'local', agent: 'claude' },
    client,
    () => ({})
  )
  controller.setHostCapability('supported')
  await controller.startLive()
  expect(controller.getSnapshot().capability).toBe('unsupported')
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
})

it('drops late SDP and native events after hiding and does not restart on reveal', async () => {
  await start()
  const peer = Peer.instances[0]
  controller.setVisible(false)
  await controller.stopLive()
  event({ type: 'sdp', sdp: 'late answer' })
  event({ type: 'started' })
  peer?.connect()
  controller.setVisible(true)
  expect(peer?.setRemoteDescription).not.toHaveBeenCalled()
  expect(controller.getSnapshot().connection).toBe('off')
  expect(client.start).toHaveBeenCalledTimes(1)
})

it('keeps native unknown retryable and distinguishes native unsupported from a failed capability check', async () => {
  await Promise.resolve()
  vi.mocked(client.capability).mockResolvedValueOnce({
    supported: null,
    reason: 'The conversation is at rest.'
  })
  controller.setHostCapability('supported')
  await waitFor(() => expect(controller.getSnapshot().capability).toBe('unknown'))
  vi.mocked(client.capability).mockResolvedValueOnce({
    supported: false,
    reason: 'This Codex version does not support voice.'
  })
  await controller.startLive()
  expect(controller.getSnapshot().capability).toBe('unsupported')
  vi.mocked(client.capability).mockRejectedValueOnce(new Error('offline'))
  await controller.startLive()
  expect(controller.getSnapshot().capability).toBe('error')
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
})

it('allows an explicit attempt on the existing conversation when only native capability is unknown', async () => {
  await Promise.resolve()
  vi.mocked(client.capability).mockResolvedValue({
    supported: null,
    reason: 'The conversation is at rest.'
  })
  controller.setHostCapability('supported')
  await waitFor(() =>
    expect(controller.getSnapshot()).toMatchObject({ capability: 'unknown', canStart: true })
  )
  await start()
  expect(client.start).toHaveBeenCalledOnce()
  controller.setHostCapability('unknown')
  expect(controller.getSnapshot().canStart).toBe(false)
})

it('restores text as soon as local media stops while the host closure is still pending', async () => {
  await start()
  let finishStop:
    | ((result: Awaited<ReturnType<AgentSessionVoiceClient['stop']>>) => void)
    | undefined
  vi.mocked(client.stop).mockImplementation(
    (owner) =>
      new Promise((resolve) => {
        finishStop = resolve
        voiceOwner = owner
      })
  )
  const switching = controller.switchToText()
  expect(controller.getSnapshot()).toMatchObject({ textMode: true, input: 'muted' })
  expect(track.stop).toHaveBeenCalledOnce()
  await waitFor(() => expect(finishStop).toBeDefined())
  if (!voiceOwner) {
    throw new Error('Expected the original voice owner')
  }
  finishStop?.({ ...voiceOwner, state: 'off' })
  await switching
  expect(client.start).toHaveBeenCalledOnce()
})

it('does not open the microphone when this window cannot coordinate capture with other windows', async () => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
  await start()
  expect(controller.getSnapshot()).toMatchObject({ capability: 'unsupported', canStart: false })
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  expect(client.start).not.toHaveBeenCalled()
})

it.each([
  [
    'NotAllowedError',
    'Microphone access is blocked. Grant it in your system settings, then try again.'
  ],
  [
    'SecurityError',
    'Microphone access is blocked. Grant it in your system settings, then try again.'
  ],
  ['NotFoundError', 'No microphone was found. Connect one, then try again.'],
  ['DevicesNotFoundError', 'No microphone was found. Connect one, then try again.'],
  ['OverconstrainedError', 'Could not open the microphone.'],
  ['NotReadableError', 'Could not open the microphone.'],
  ['TrackStartError', 'Could not open the microphone.'],
  ['OperationError', 'Live voice could not connect. Try again.']
])(
  'reports a safe microphone failure for %s and releases capture without starting native voice',
  async (name, reason) => {
    const privateDetail = 'Untrusted media payload must not be shown'
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException(privateDetail, name)
    )
    await start()
    await waitFor(() =>
      expect(controller.getSnapshot()).toMatchObject({ connection: 'error', reason })
    )
    expect(controller.getSnapshot()).toMatchObject({
      capability: 'supported',
      canStart: true,
      input: 'muted',
      output: 'silent'
    })
    expect(controller.getSnapshot().reason).not.toContain(privateDetail)
    expect(microphoneCaptureIsBusy()).toBe(false)
    expect(client.start).not.toHaveBeenCalled()
  }
)

it('waits for the browser unlock before transferring Live capture to the existing dictation capture path', async () => {
  let browserUnlock: (() => void) | undefined
  let first = true
  vi.stubGlobal('navigator', {
    mediaDevices: navigator.mediaDevices,
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object) => Promise<void>
      ) => {
        await callback({})
        if (first) {
          first = false
          await new Promise<void>((resolve) => {
            browserUnlock = resolve
          })
        }
      }
    }
  })
  await start()
  let ready = false
  const preparing = controller.prepareDictation().then((result) => {
    ready = result
  })
  await waitFor(() => expect(browserUnlock).toBeDefined())
  expect(track.stop).toHaveBeenCalledOnce()
  expect(microphoneCaptureIsBusy()).toBe(true)
  expect(ready).toBe(false)
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
  browserUnlock?.()
  await preparing
  expect(ready).toBe(true)
  const dictation = new MicrophoneCaptureSession()
  await dictation.open()
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
  await dictation.stop()
})
