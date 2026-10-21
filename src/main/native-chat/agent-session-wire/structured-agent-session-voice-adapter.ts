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
