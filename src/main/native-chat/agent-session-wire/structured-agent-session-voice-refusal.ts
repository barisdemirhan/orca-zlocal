import { refuse } from '../../../shared/agent-session/failures/agent-session-wire-refusals'

export function invalidAgentSessionVoiceOperation(message: string) {
  return {
    ok: false as const,
    refusal: refuse('agent_session_operation_invalid', { reason: 'providerRejected' }, message)
  }
}
