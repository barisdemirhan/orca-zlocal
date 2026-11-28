import { MicrophoneCaptureSession } from '../dictation/microphone-capture-session'

type VoiceMediaCallbacks = {
  onReady: (ready: boolean) => void
  onOutput: (speaking: boolean) => void
  onSpeech: (phase: 'started' | 'stopped', itemId: string) => void
  onFailure: (reason: 'input-lost' | 'connection-lost' | 'playback-blocked') => void
}

export class AgentHubOrbVoiceMedia {
  private peer: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private stream: MediaStream | null = null
  private audio: HTMLAudioElement | null = null
  private readonly capture = new MicrophoneCaptureSession(true)
  private outputEnabled = false
  private outputMuted = false
  private speaking = false
  private meterContext: AudioContext | null = null
  private meterSource: MediaStreamAudioSourceNode | null = null
  private meterFrame: number | null = null
  private stopped = false
  private answerApplied = false
  private readonly abort = new AbortController()

  constructor(private readonly callbacks: VoiceMediaCallbacks) {}

  async createOffer(preference?: {
    deviceId?: string | null
    label?: string | null
  }): Promise<string | null> {
    if (this.stopped) {
      return null
    }
    const capture = await this.capture.open(preference)
    if (!capture) {
      return null
    }
    this.stream = capture.stream
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', this.inputLost)
    }
    const peer = new RTCPeerConnection()
    this.peer = peer
    const audio = document.createElement('audio')
    audio.autoplay = true
    audio.muted = true
    this.audio = audio
    peer.onconnectionstatechange = () => {
      if (this.stopped) {
        return
      }
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        this.callbacks.onFailure('connection-lost')
      } else {
        this.publishReady()
      }
    }
    peer.ontrack = (event) => {
      if (this.stopped) {
        return
      }
      const output = event.streams[0] ?? new MediaStream([event.track])
      audio.srcObject = output
      this.measureOutput(output)
      void audio.play().catch(() => {
        if (!this.stopped) {
          this.callbacks.onFailure('playback-blocked')
        }
      })
    }
    this.channel = peer.createDataChannel('oai-events')
    this.channel.onmessage = this.inputSpeech
    this.channel.onopen = () => this.publishReady()
    this.channel.onclose = () => {
      if (!this.stopped) {
        this.callbacks.onFailure('connection-lost')
      }
    }
    for (const track of this.stream.getAudioTracks()) {
      peer.addTrack(track, this.stream)
    }
    await peer.setLocalDescription(await peer.createOffer())
    await this.waitForIce(peer)
    if (this.stopped) {
      return null
    }
    const sdp = peer.localDescription?.sdp
    if (!sdp) {
      throw new Error('The voice connection did not provide an offer.')
    }
    return sdp
  }

  async applyAnswer(sdp: string): Promise<void> {
    if (this.stopped || !this.peer) {
      return
    }
    await this.peer.setRemoteDescription({ type: 'answer', sdp })
    if (this.stopped) {
      return
    }
    this.answerApplied = true
    this.publishReady()
  }

  setMuted(muted: boolean): void {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }

  setOutputEnabled(enabled: boolean): void {
    if (this.stopped) {
      return
    }
    this.outputEnabled = enabled
    if (this.audio) {
      this.audio.muted = !enabled || this.outputMuted
    }
    if (!enabled) {
      this.publishOutput(false)
    }
  }

  setOutputMuted(muted: boolean): void {
    this.outputMuted = muted
    this.setOutputEnabled(this.outputEnabled)
    if (muted) {
      this.publishOutput(false)
    }
  }

  stop(): Promise<void> {
    this.stopped = true
    this.abort.abort()
    if (this.meterFrame !== null) {
      cancelAnimationFrame(this.meterFrame)
    }
    this.meterFrame = null
    this.meterSource?.disconnect()
    this.meterSource = null
    void this.meterContext?.close().catch(() => undefined)
    this.meterContext = null
    if (this.audio) {
      this.audio.muted = true
      this.audio.pause()
      this.audio.srcObject = null
      this.audio = null
    }
    this.channel?.close()
    this.channel = null
    this.peer?.close()
    this.peer = null
    this.stream
      ?.getAudioTracks()
      .forEach((track) => track.removeEventListener('ended', this.inputLost))
    const stopped = this.capture.stop()
    this.stream = null
    return stopped
  }

  private readonly inputLost = (): void => {
    if (!this.stopped) {
      this.callbacks.onFailure('input-lost')
    }
  }

  private readonly inputSpeech = (event: MessageEvent): void => {
    if (this.stopped || typeof event.data !== 'string') {
      return
    }
    try {
      const payload: unknown = JSON.parse(event.data)
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('type' in payload) ||
        !('item_id' in payload) ||
        typeof payload.item_id !== 'string' ||
        !payload.item_id
      ) {
        return
      }
      if (payload.type === 'input_audio_buffer.speech_started') {
        this.callbacks.onSpeech('started', payload.item_id)
      } else if (payload.type === 'input_audio_buffer.speech_stopped') {
        this.callbacks.onSpeech('stopped', payload.item_id)
      }
    } catch {
      // Other data-channel messages do not control playback.
    }
  }

  private publishOutput(speaking: boolean): void {
    if (speaking === this.speaking) {
      return
    }
    this.speaking = speaking
    this.callbacks.onOutput(speaking)
  }

  private measureOutput(stream: MediaStream): void {
    if (this.meterContext) {
      return
    }
    const context = new AudioContext()
    this.meterContext = context
    const source = context.createMediaStreamSource(stream)
    this.meterSource = source
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    void context.resume().catch(() => undefined)
    const samples = new Float32Array(analyser.fftSize)
    let lastAudioAt = Number.NEGATIVE_INFINITY
    const measure = (): void => {
      if (this.stopped) {
        return
      }
      analyser.getFloatTimeDomainData(samples)
      if (samples.some((sample) => Math.abs(sample) > 0.01)) {
        lastAudioAt = performance.now()
      }
      this.publishOutput(
        this.outputEnabled && !this.outputMuted && performance.now() - lastAudioAt < 180
      )
      this.meterFrame = requestAnimationFrame(measure)
    }
    this.meterFrame = requestAnimationFrame(measure)
  }

  private publishReady(): void {
    if (this.stopped) {
      return
    }
    this.callbacks.onReady(
      this.answerApplied &&
        this.peer?.connectionState === 'connected' &&
        this.channel?.readyState === 'open'
    )
  }

  private waitForIce(peer: RTCPeerConnection): Promise<void> {
    if (peer.iceGatheringState === 'complete' || this.stopped) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const finish = (failed = false): void => {
        clearTimeout(timer)
        peer.removeEventListener('icegatheringstatechange', changed)
        this.abort.signal.removeEventListener('abort', cancelled)
        if (failed) {
          reject(new Error('The voice connection timed out.'))
        } else {
          resolve()
        }
      }
      const changed = (): void => {
        if (peer.iceGatheringState === 'complete') {
          finish()
        }
      }
      const cancelled = (): void => finish()
      const timer = setTimeout(() => finish(true), 10_000)
      peer.addEventListener('icegatheringstatechange', changed)
      this.abort.signal.addEventListener('abort', cancelled, { once: true })
    })
  }
}
