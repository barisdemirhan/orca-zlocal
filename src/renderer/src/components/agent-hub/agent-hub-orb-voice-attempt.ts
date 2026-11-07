import type {
  AgentSessionVoiceOwner,
  AgentSessionVoiceEvent
} from '../../../../shared/agent-session-voice'
import type { AgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import type { AgentHubOrbVoiceMedia } from './agent-hub-orb-voice-media'
import { AgentHubOrbVoicePlayback } from './agent-hub-orb-voice-playback'

export type AgentHubOrbVoiceAttempt = AgentSessionVoiceOwner & {
  media: AgentHubOrbVoiceMedia
  playback: AgentHubOrbVoicePlayback
  dead: boolean
  started: boolean
  ready: boolean
  remoteClosed: boolean
  subscriptionReady: Promise<void>
  signalReady: () => void
  unsubscribe?: () => void
  start?: Promise<unknown>
  timeout?: ReturnType<typeof setTimeout>
  localStop?: Promise<void>
}

export function createAgentHubOrbVoiceAttempt(
  generation: number,
  media: AgentHubOrbVoiceMedia
): AgentHubOrbVoiceAttempt {
  let signalReady = (): void => {}
  const subscriptionReady = new Promise<void>((resolve) => {
    signalReady = resolve
  })
  return {
    voiceSessionId: createBrowserUuid(),
    generation,
    media,
    playback: new AgentHubOrbVoicePlayback((enabled) => media.setOutputEnabled(enabled)),
    dead: false,
    started: false,
    ready: false,
    remoteClosed: false,
    subscriptionReady,
    signalReady
  }
}

export async function startAgentHubOrbVoiceAttempt(
  attempt: AgentHubOrbVoiceAttempt,
  client: AgentSessionVoiceClient,
  microphonePreference: () => { deviceId?: string | null; label?: string | null },
  onEvent: (event: AgentSessionVoiceEvent) => void,
  onDisconnect: () => void
): Promise<void> {
  const subscription = await client.subscribe(attempt, onEvent, onDisconnect)
  attempt.unsubscribe = subscription.unsubscribe
  if (attempt.dead) {
    subscription.unsubscribe()
    return
  }
  await attempt.subscriptionReady
  if (attempt.dead) {
    return
  }
  const sdp = await attempt.media.createOffer(microphonePreference())
  if (attempt.dead || sdp === null) {
    return
  }
  attempt.start = client.start(attempt, sdp)
  await attempt.start
}

export function deliverAgentHubOrbVoiceEvent(
  sessionId: string,
  attempt: AgentHubOrbVoiceAttempt,
  event: AgentSessionVoiceEvent,
  callbacks: {
    started: () => void
    closed: () => void
    failed: (error: unknown) => void
    transcript?: (event: Extract<AgentSessionVoiceEvent, { type: 'transcript' }>) => void
  }
): void {
  if (
    event.sessionId !== sessionId ||
    event.voiceSessionId !== attempt.voiceSessionId ||
    event.generation !== attempt.generation
  ) {
    return
  }
  if (event.type === 'closed') {
    attempt.remoteClosed = true
    callbacks.closed()
  } else if (!attempt.dead) {
    if (event.type === 'ready') {
      attempt.signalReady()
    } else if (event.type === 'started') {
      attempt.started = true
      callbacks.started()
    } else if (event.type === 'sdp') {
      void attempt.media.applyAnswer(event.sdp).catch(callbacks.failed)
    } else if (event.type === 'transcript') {
      attempt.playback.accept(event)
      callbacks.transcript?.(event)
    } else if (event.type === 'error') {
      callbacks.failed(new Error(event.message))
    }
  }
}

export async function stopAgentHubOrbVoiceAttempt(
  attempt: AgentHubOrbVoiceAttempt,
  client: AgentSessionVoiceClient
): Promise<boolean> {
  const [verified] = await Promise.all([verifyNativeStop(attempt, client), attempt.localStop])
  return verified
}

async function verifyNativeStop(
  attempt: AgentHubOrbVoiceAttempt,
  client: AgentSessionVoiceClient
): Promise<boolean> {
  await attempt.start?.catch(() => undefined)
  if (!attempt.start || attempt.remoteClosed) {
    return true
  }
  try {
    return (await client.stop(attempt)).state === 'off' || attempt.remoteClosed
  } catch {
    return attempt.remoteClosed
  }
}
export function promoteAgentHubOrbVoiceAttempt(
  attempt: AgentHubOrbVoiceAttempt,
  promote: () => void
): void {
  if (!attempt.started || !attempt.ready || attempt.dead) {
    return
  }
  clearTimeout(attempt.timeout)
  promote()
}
