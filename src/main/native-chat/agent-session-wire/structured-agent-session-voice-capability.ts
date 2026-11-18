import type { AgentSessionVoiceCapability } from '../../../shared/agent-session-voice'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host/execution-host'
import type { StructuredAgentSessionMutationContext } from './operations/structured-agent-session-mutation-context'

/** Whether the conversation's own host and provider can run native Codex Live voice. */
export function codexVoiceTargetCapability(
  deps: StructuredAgentSessionMutationContext['deps'],
  sessionId: string
): AgentSessionVoiceCapability {
  const record = deps.store.getRecord(sessionId)
  if (!record) {
    return { supported: false, reason: 'This conversation is unavailable.' }
  }
  if (record.provider !== 'codex') {
    return { supported: false, reason: 'Live voice requires a Codex conversation.' }
  }
  if (
    record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
    record.location.wslDistro !== null
  ) {
    return {
      supported: false,
      reason: 'This execution host does not support native Codex Live voice.'
    }
  }
  const adapter = deps.agents.registration(record.provider)?.adapter
  return adapter?.voice
    ? { supported: true, accountAccess: 'unchecked' }
    : { supported: false, reason: 'This host does not support native Codex Live voice.' }
}
