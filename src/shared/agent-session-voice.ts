import type { AgentSessionMutationEnvelope } from './agent-session/agent-session-wire'

export const AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY = 'agent-session.codex-voice.v1' as const
export const AGENT_SESSION_VOICE_MAX_SDP_LENGTH = 128 * 1024

export type AgentSessionVoiceOwner = {
  voiceSessionId: string
  generation: number
}

export type AgentSessionVoiceCapability =
  | { supported: true; accountAccess: 'unchecked' }
  | { supported: false; reason: string }
  | { supported: null; reason: string }

export type AgentSessionVoiceStartParams = AgentSessionVoiceOwner & {
  envelope: AgentSessionMutationEnvelope
  sdp: string
}

export type AgentSessionVoiceStopParams = AgentSessionVoiceOwner & {
  envelope: AgentSessionMutationEnvelope
}

export type AgentSessionVoiceTextParams = AgentSessionVoiceStopParams & { text: string }
export type AgentSessionVoiceTextResult = AgentSessionVoiceOwner & { applied: boolean }

export type AgentSessionVoiceResult = AgentSessionVoiceOwner & {
  state: 'connecting' | 'off' | 'unverifiable'
}

/** Signalling is live-only and is never part of a journal snapshot or replay. */
export type AgentSessionVoiceEvent = AgentSessionVoiceOwner & { sessionId: string } & (
    | { type: 'ready' }
    | { type: 'started' }
    | { type: 'sdp'; sdp: string }
    | { type: 'error'; message: string }
    | { type: 'closed'; reason: string }
    | {
        type: 'transcript'
        role: 'user' | 'assistant'
        phase: 'started' | 'delta' | 'done'
        itemId: string
        hasText: boolean
        /** Optional live assistant captions; older hosts send activity alone. Never replayed. */
        text?: string
      }
  )

export function agentSessionVoiceStartFields(
  input: AgentSessionVoiceOwner & { sdp: string }
): Record<string, unknown> {
  return { voiceSessionId: input.voiceSessionId, generation: input.generation, sdp: input.sdp }
}

export function agentSessionVoiceStopFields(
  input: AgentSessionVoiceOwner
): Record<string, unknown> {
  return { voiceSessionId: input.voiceSessionId, generation: input.generation }
}

export function isAgentSessionVoiceSdp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= AGENT_SESSION_VOICE_MAX_SDP_LENGTH &&
    value.startsWith('v=0') &&
    !value.includes('\0') &&
    /(?:^|\r?\n)m=audio\s/.test(value)
  )
}
