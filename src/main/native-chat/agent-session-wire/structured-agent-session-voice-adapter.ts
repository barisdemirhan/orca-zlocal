import type {
  AgentSessionVoiceCapability,
  AgentSessionVoiceOwner,
  AgentSessionVoiceResult
} from '../../../shared/agent-session-voice'

export type StructuredAgentSessionVoiceAdapter = {
  appendText(
    input: AgentSessionVoiceOwner & { sessionId: string; fence: number; text: string }
  ): Promise<boolean>
  start(
    input: AgentSessionVoiceOwner & { sessionId: string; fence: number; sdp: string }
  ): Promise<{ ok: true; value: AgentSessionVoiceResult } | { ok: false; rejected: string }>
  stop(
    input: AgentSessionVoiceOwner & { sessionId: string; fence: number }
  ): Promise<AgentSessionVoiceResult>
  /** An active or unconfirmed voice transport keeps the existing provider child alive. */
  holds(sessionId: string): boolean
  capability(sessionId: string): Promise<AgentSessionVoiceCapability>
}

type VoiceOwnerLookup = (sessionId: string) => { voice?: StructuredAgentSessionVoiceAdapter } | null

/** Routes voice to the session's provider adapter; a live owner is required past `start`. */
export function routeStructuredAgentSessionVoice(
  owner: VoiceOwnerLookup,
  liveOwner: VoiceOwnerLookup
): StructuredAgentSessionVoiceAdapter {
  return {
    start: (input) =>
      owner(input.sessionId)?.voice?.start(input) ??
      Promise.resolve({ ok: false, rejected: 'Live voice is unavailable for this provider.' }),
    appendText: (input) =>
      liveOwner(input.sessionId)?.voice?.appendText(input) ?? Promise.resolve(false),
    stop: (input) =>
      liveOwner(input.sessionId)?.voice?.stop(input) ??
      Promise.resolve({
        voiceSessionId: input.voiceSessionId,
        generation: input.generation,
        state: 'off'
      }),
    holds: (sessionId) => liveOwner(sessionId)?.voice?.holds(sessionId) === true,
    capability: (sessionId) =>
      liveOwner(sessionId)?.voice?.capability(sessionId) ??
      Promise.resolve({
        supported: null,
        reason: 'Native voice support will be checked when this conversation connects.'
      })
  }
}
