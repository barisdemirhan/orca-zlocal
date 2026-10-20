import { randomUUID } from 'node:crypto'
import { readInjectedAgentSessionId } from '../../shared/agent-session-caller-env'
import { readOrchestrationCompatibilityEvidence } from '../../shared/orchestration-compatibility-evidence'
import type { RuntimeOrchestrationEnvelope } from '../../shared/runtime-rpc-envelope'

export function createOrchestrationCompatibilityEnvelope(
  env: NodeJS.ProcessEnv
): RuntimeOrchestrationEnvelope {
  const evidence = readOrchestrationCompatibilityEvidence(env)
  // Only local environment session ids can identify a session on this host.
  const agentSessionId = readInjectedAgentSessionId(env)
  return {
    compatibilityInvocationId: randomUUID(),
    orchestrationCompatibilityEvidence: agentSessionId ? { ...evidence, agentSessionId } : evidence
  }
}

export function runtimeMethodCompatibilityEnvelope(
  method: string,
  envelope: RuntimeOrchestrationEnvelope,
  requestId?: string
): RuntimeOrchestrationEnvelope {
  const sessionWrite =
    (method === 'terminal.send' || method === 'agentSession.send') &&
    envelope.orchestrationCompatibilityEvidence?.agentSessionId
  return method.startsWith('orchestration.') || sessionWrite
    ? { ...envelope, compatibilityInvocationId: requestId ?? envelope.compatibilityInvocationId }
    : {}
}
