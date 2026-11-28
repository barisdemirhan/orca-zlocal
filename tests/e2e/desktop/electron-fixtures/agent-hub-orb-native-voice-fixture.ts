import type { Page } from '@stablyai/playwright-test'
import { test as base } from './agent-hub-orb-fixture'

type VoiceDeviceObservation = {
  captures: number
  liveTracks: number
  enabledTracks: number
  connectedPeers: number
  playbackStarts: number
  sentEvents: string[]
}

type VoiceDeviceFixture = {
  observation: () => VoiceDeviceObservation
  denyMicrophone: boolean
  receive: (event: Record<string, unknown>) => void
}

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Window declaration merging requires an interface.
  interface Window {
    __orcaNativeVoiceDevice?: VoiceDeviceFixture
  }
}

// Only the device and remote WebRTC endpoint are synthetic; session/RPC/journal/UI stay real.
async function installNativeVoiceDevice(page: Page): Promise<void> {
  await page.evaluate(() => {
    const contexts: AudioContext[] = []
    const tracks: MediaStreamTrack[] = []
    const peers: VoicePeer[] = []
    let captures = 0
    let playbackStarts = 0
    const sentEvents: string[] = []

    class VoiceChannel extends EventTarget {
      readyState = 'connecting'
      label = 'oai-events'
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onclose: ((event: Event) => void) | null = null

      open(): void {
        this.readyState = 'open'
        const event = new Event('open')
        this.dispatchEvent(event)
        this.onopen?.(event)
      }

      send(data: string): void {
        if (this.readyState !== 'open') {
          throw new Error('Voice channel is closed')
        }
        sentEvents.push(data)
      }

      receive(data: Record<string, unknown>): void {
        const event = new MessageEvent('message', { data: JSON.stringify(data) })
        this.dispatchEvent(event)
        this.onmessage?.(event)
      }

      close(): void {
        this.readyState = 'closed'
        const event = new Event('close')
        this.dispatchEvent(event)
        this.onclose?.(event)
      }
    }

    class VoicePeer extends EventTarget {
      connectionState = 'new'
      iceConnectionState = 'new'
      iceGatheringState = 'complete'
      localDescription: RTCSessionDescriptionInit | null = null
      remoteDescription: RTCSessionDescriptionInit | null = null
      onconnectionstatechange: ((event: Event) => void) | null = null
      oniceconnectionstatechange: ((event: Event) => void) | null = null
      ontrack: ((event: RTCTrackEvent) => void) | null = null
      channel = new VoiceChannel()
      senders: { track: MediaStreamTrack; replaceTrack: (track: MediaStreamTrack) => void }[] = []

      constructor() {
        super()
        peers.push(this)
      }

      createDataChannel(): VoiceChannel {
        return this.channel
      }

      addTrack(track: MediaStreamTrack) {
        const sender = {
          track,
          replaceTrack(next: MediaStreamTrack) {
            this.track = next
          }
        }
        this.senders.push(sender)
        return sender
      }

      getSenders() {
        return this.senders
      }

      async createOffer(): Promise<RTCSessionDescriptionInit> {
        return {
          type: 'offer',
          sdp: 'v=0\r\ns=orca-e2e-voice-offer\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
        }
      }

      async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
        this.localDescription = description
        this.connectionState = 'connecting'
      }

      async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
        if (!description.sdp?.includes('orca-e2e-voice-answer')) {
          throw new Error('Unexpected external voice SDP answer')
        }
        this.remoteDescription = description
        this.connectionState = 'connected'
        this.iceConnectionState = 'connected'
        const event = new Event('connectionstatechange')
        this.dispatchEvent(event)
        this.onconnectionstatechange?.(event)
        this.channel.open()
      }

      close(): void {
        this.connectionState = 'closed'
        this.iceConnectionState = 'closed'
        this.channel.close()
        const event = new Event('connectionstatechange')
        this.dispatchEvent(event)
        this.onconnectionstatechange?.(event)
      }
    }

    const fixture: VoiceDeviceFixture = {
      denyMicrophone: false,
      observation: () => ({
        captures,
        liveTracks: tracks.filter((track) => track.readyState === 'live').length,
        enabledTracks: tracks.filter((track) => track.readyState === 'live' && track.enabled)
          .length,
        connectedPeers: peers.filter((peer) => peer.connectionState === 'connected').length,
        playbackStarts,
        sentEvents: [...sentEvents]
      }),
      receive: (event) => {
        for (const peer of peers) {
          peer.channel.receive(event)
        }
      }
    }
    window.__orcaNativeVoiceDevice = fixture
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        getUserMedia: async () => {
          captures += 1
          if (fixture.denyMicrophone) {
            throw new DOMException(
              'Microphone permission denied by device fixture',
              'NotAllowedError'
            )
          }
          const context = new AudioContext()
          contexts.push(context)
          const stream = context.createMediaStreamDestination().stream
          tracks.push(...stream.getAudioTracks())
          for (const track of stream.getAudioTracks()) {
            track.addEventListener('ended', () => void context.close())
          }
          return stream
        }
      }
    })
    Object.defineProperty(window, 'RTCPeerConnection', { configurable: true, value: VoicePeer })
    HTMLMediaElement.prototype.play = async function () {
      playbackStarts += 1
    }
  })
}

export const test = base.extend({
  orcaPage: async ({ sharedPage }, provideFixture) => {
    await installNativeVoiceDevice(sharedPage)
    await provideFixture(sharedPage)
  }
})

export async function observeVoiceDevice(page: Page): Promise<VoiceDeviceObservation> {
  return page.evaluate(() => {
    const fixture = window.__orcaNativeVoiceDevice
    if (!fixture) {
      throw new Error('Native voice device fixture is missing')
    }
    return fixture.observation()
  })
}
