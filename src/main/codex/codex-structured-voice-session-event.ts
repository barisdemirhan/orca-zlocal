import type { AgentSessionVoiceEvent } from '../../shared/agent-session-voice'

/** A live voice event, sent through the structured session's event stream. */
export type CodexStructuredVoiceSessionEvent = {
  type: 'voice'
  sessionId: string
  fence: number
  acquisitionGeneration: string
  event: AgentSessionVoiceEvent
}
