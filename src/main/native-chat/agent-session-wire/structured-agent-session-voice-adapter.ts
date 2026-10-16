import type {
  AgentSessionVoiceCapability,
  AgentSessionVoiceOwner,
  AgentSessionVoiceResult
} from '../../../shared/agent-session-voice'

export type StructuredAgentSessionVoiceAdapter = {
  startVoice?(
    input: AgentSessionVoiceOwner & { sessionId: string; fence: number; sdp: string }
  ): Promise<{ ok: true; value: AgentSessionVoiceResult } | { ok: false; rejected: string }>
  stopVoice?(
    input: AgentSessionVoiceOwner & { sessionId: string; fence: number }
  ): Promise<AgentSessionVoiceResult>
  /** An active or unconfirmed voice transport keeps the existing provider child alive. */
  holdsVoice?(sessionId: string): boolean
  readVoiceCapability?(sessionId: string): Promise<AgentSessionVoiceCapability>
}
