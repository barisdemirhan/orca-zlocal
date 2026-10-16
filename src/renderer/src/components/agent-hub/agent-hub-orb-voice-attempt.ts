import type {
  AgentSessionVoiceOwner,
  AgentSessionVoiceEvent
} from '../../../../shared/agent-session-voice'
import type { AgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import type { AgentHubOrbVoiceMedia } from './agent-hub-orb-voice-media'
import type { AgentHubOrbVoicePlayback } from './agent-hub-orb-voice-playback'

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

export function deliverAgentHubOrbVoiceEvent(
  sessionId: string,
  attempt: AgentHubOrbVoiceAttempt,
  event: AgentSessionVoiceEvent,
  callbacks: { started: () => void; closed: () => void; failed: () => void }
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
    } else if (event.type === 'error') {
      callbacks.failed()
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
