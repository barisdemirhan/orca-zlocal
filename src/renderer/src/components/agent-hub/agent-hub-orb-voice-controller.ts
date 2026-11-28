import { createOrbVoiceContext } from './agent-hub-orb-context-delivery'
import { checkAgentHubOrbVoiceCapability } from './agent-hub-orb-voice-capability'
import type { AgentSessionVoiceEvent } from '../../../../shared/agent-session-voice'
import type { AgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import type { StructuredAgentSessionHostCapabilityState } from '../../../../shared/agent-session/capabilities/structured-agent-session-host-capability'
import { microphoneCaptureIsBusy } from '../dictation/microphone-capture-lease'
import {
  agentHubOrbVoiceMediaFailure,
  agentHubOrbVoiceStartFailure
} from './agent-hub-orb-voice-failure'
import { AgentHubOrbVoiceMedia } from './agent-hub-orb-voice-media'
import { AgentHubOrbVoiceCaptions } from './agent-hub-orb-voice-captions'
import {
  EMPTY_ORB_VOICE_SNAPSHOT,
  nextAgentHubOrbVoiceSnapshot,
  type AgentHubOrbVoiceSnapshot
} from './agent-hub-orb-voice-state'
import {
  createAgentHubOrbVoiceAttempt,
  promoteAgentHubOrbVoiceAttempt,
  startAgentHubOrbVoiceAttempt,
  stopAgentHubOrbVoiceAttempt,
  deliverAgentHubOrbVoiceEvent,
  type AgentHubOrbVoiceAttempt as Attempt
} from './agent-hub-orb-voice-attempt'

export class AgentHubOrbVoiceController {
  private snapshot = EMPTY_ORB_VOICE_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private hostCapability: StructuredAgentSessionHostCapabilityState = 'unknown'
  private generation = 0
  private startRequest = 0
  private visible = true
  private attempt: Attempt | null = null
  private stopping: Promise<void> | null = null
  private checking: Promise<void> | null = null
  private mediaSupported = true
  private readonly captions = new AgentHubOrbVoiceCaptions((caption) => this.publish({ caption }))

  readonly context: ReturnType<typeof createOrbVoiceContext>

  constructor(
    readonly owner: { sessionId: string; tabId: string; hostKey: string; agent: string },
    private readonly client: AgentSessionVoiceClient,
    private readonly microphonePreference: () => { deviceId?: string | null; label?: string | null }
  ) {
    this.context = createOrbVoiceContext(client, () => ({
      sessionId: this.owner.sessionId,
      attempt: this.attempt,
      live: this.snapshot.connection === 'live'
    }))
  }

  readonly getSnapshot = (): AgentHubOrbVoiceSnapshot => this.snapshot
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(change: Partial<AgentHubOrbVoiceSnapshot>): void {
    this.snapshot = nextAgentHubOrbVoiceSnapshot(
      this.snapshot,
      change,
      this.hostCapability === 'supported' && this.owner.agent === 'codex' && this.mediaSupported
    )
    for (const listener of this.listeners) {
      listener()
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    if (!visible) {
      void this.stopLive()
    }
  }

  setHostCapability(capability: StructuredAgentSessionHostCapabilityState): void {
    this.hostCapability = capability
    if (capability !== 'supported' || this.owner.agent !== 'codex') {
      this.publish({ capability: this.owner.agent !== 'codex' ? 'unsupported' : capability })
      if (capability === 'unsupported') {
        void this.stopLive()
      }
      return
    }
    void this.checkCapability()
  }

  private checkCapability(): Promise<void> {
    if (this.checking) {
      return this.checking
    }
    if (this.hostCapability !== 'supported' || this.owner.agent !== 'codex') {
      return Promise.resolve()
    }
    this.publish({ capability: 'checking', reason: undefined })
    const checking = checkAgentHubOrbVoiceCapability(this.client, (change) =>
      this.publish(change)
    ).finally(() => {
      if (this.checking === checking) {
        this.checking = null
      }
    })
    this.checking = checking
    return checking
  }

  readonly startLive = async (): Promise<void> => {
    if (
      !this.visible ||
      !this.mediaSupported ||
      this.owner.agent !== 'codex' ||
      this.hostCapability !== 'supported'
    ) {
      return
    }
    if (this.attempt) {
      if (!this.attempt.dead) {
        return
      }
      await this.stopLive()
      if (this.attempt) {
        return
      }
    }
    const startRequest = ++this.startRequest
    await this.checkCapability()
    if (
      startRequest !== this.startRequest ||
      !this.visible ||
      this.hostCapability !== 'supported' ||
      this.snapshot.capability === 'unsupported' ||
      this.snapshot.capability === 'error' ||
      this.attempt
    ) {
      return
    }
    if (microphoneCaptureIsBusy()) {
      this.publish({ reason: 'The microphone is already in use by another recording.' })
      return
    }
    const generation = ++this.generation
    const media = new AgentHubOrbVoiceMedia({
      onReady: (ready) => {
        if (this.attempt?.generation !== generation || this.attempt.dead) {
          return
        }
        this.attempt.ready = ready
        this.promote(this.attempt)
      },
      onOutput: (speaking) => {
        if (this.attempt?.generation === generation && !this.attempt.dead) {
          this.publish({ output: speaking ? 'speaking' : 'silent' })
        }
      },
      onSpeech: (phase, itemId) => {
        if (this.attempt?.generation === generation && !this.attempt.dead) {
          this.publish({
            inputSpeaking: phase === 'started' && this.snapshot.input === 'listening'
          })
          attempt.playback.inputSpeech(phase, itemId)
        }
      },
      onFailure: (reason) => this.fail(generation, agentHubOrbVoiceMediaFailure(reason))
    })
    const attempt = createAgentHubOrbVoiceAttempt(generation, media)
    this.attempt = attempt
    this.captions.reset()
    this.publish({
      connection: 'connecting',
      input: 'muted',
      output: 'silent',
      outputMuted: false,
      inputSpeaking: false,
      caption: undefined,
      textMode: false,
      reason: undefined
    })
    attempt.timeout = setTimeout(
      () => this.fail(generation, 'Live voice did not finish connecting. Try again.'),
      25_000
    )
    try {
      await startAgentHubOrbVoiceAttempt(
        attempt,
        this.client,
        this.microphonePreference,
        (event) => this.accept(attempt, event),
        () => this.fail(generation, 'The voice host connection was lost.')
      )
    } catch (error) {
      const failure = agentHubOrbVoiceStartFailure(error)
      if (failure.mediaUnsupported) {
        this.mediaSupported = false
        this.publish({ capability: 'unsupported' })
      }
      if (!attempt.dead) {
        this.fail(generation, failure.reason)
      }
    }
  }

  private promote = (attempt: Attempt): void =>
    promoteAgentHubOrbVoiceAttempt(attempt, () =>
      this.publish({ connection: 'live', input: 'listening' })
    )

  private accept(attempt: Attempt, event: AgentSessionVoiceEvent): void {
    if (this.attempt !== attempt) {
      return
    }
    deliverAgentHubOrbVoiceEvent(this.owner.sessionId, attempt, event, {
      transcript: (transcript) => this.captions.accept(transcript),
      started: () => this.promote(attempt),
      closed: () => {
        void this.stopLive()
      },
      failed: (error) => this.fail(attempt.generation, agentHubOrbVoiceStartFailure(error).reason)
    })
  }

  private fail(generation: number, reason: string): void {
    if (this.attempt?.generation !== generation || this.attempt.dead) {
      return
    }
    void this.stopLive().then(() => {
      if (this.generation === generation) {
        this.publish({ connection: 'error', reason, textMode: true })
      }
    })
  }

  readonly stopLive = (): Promise<void> => {
    ++this.startRequest
    if (this.stopping) {
      return this.stopping
    }
    const attempt = this.attempt
    if (!attempt) {
      return Promise.resolve()
    }
    attempt.dead = true
    this.captions.reset()
    attempt.signalReady()
    clearTimeout(attempt.timeout)
    attempt.localStop = attempt.media.stop()
    this.publish({
      connection: 'stopping',
      input: 'muted',
      output: 'silent',
      inputSpeaking: false,
      caption: undefined
    })
    const stopping = this.finishStop(attempt).finally(() => {
      if (this.stopping === stopping) {
        this.stopping = null
      }
    })
    this.stopping = stopping
    return stopping
  }

  private async finishStop(attempt: Attempt): Promise<void> {
    const verified = await stopAgentHubOrbVoiceAttempt(attempt, this.client)
    if (verified) {
      attempt.unsubscribe?.()
      if (this.attempt === attempt) {
        this.attempt = null
      }
      this.publish({ connection: 'off' })
    } else {
      this.publish({
        connection: 'error',
        reason: 'Voice input is off. The connection closure could not be verified.'
      })
    }
  }

  readonly muteInput = (muted: boolean): void => {
    if (!this.attempt || this.attempt.dead || this.snapshot.connection !== 'live') {
      return
    }
    this.attempt.media.setMuted(muted)
    this.publish({
      input: muted ? 'muted' : 'listening',
      ...(muted ? { inputSpeaking: false } : {})
    })
  }

  readonly muteOutput = (muted: boolean): void => {
    if (!this.attempt || this.attempt.dead || this.snapshot.connection !== 'live') {
      return
    }
    this.attempt.media.setOutputMuted(muted)
    this.publish({ outputMuted: muted })
  }

  readonly stopSpeaking = (): void => {
    this.attempt?.playback.suppress()
  }
  readonly switchToText = async (): Promise<void> => {
    const stopping = this.stopLive()
    this.publish({ textMode: true })
    await stopping
  }
  readonly prepareDictation = async (): Promise<boolean> => {
    await this.switchToText()
    return !microphoneCaptureIsBusy() && this.attempt === null
  }
}
