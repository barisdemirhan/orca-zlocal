import type {
  AgentSessionVoiceOwner,
  AgentSessionVoiceTextResult
} from '../../../shared/agent-session-voice'
import { agentSessionVoiceStopFields } from '../../../shared/agent-session-voice'
import type { AgentSessionMutationResult } from '../../../shared/agent-session/agent-session-wire'
import type { RuntimeClientTarget } from '../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { structuredAgentSessionPayloadFingerprint } from '../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import { structuredSessionOperationId } from '../components/native-chat/session/structured/writes/structured-agent-session-operation-id'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'

export async function appendAgentSessionVoiceText(
  target: RuntimeClientTarget,
  sessionId: string,
  fence: number,
  owner: AgentSessionVoiceOwner,
  text: string,
  options?: Parameters<typeof callRuntimeRpc>[3]
): Promise<boolean> {
  if (!text.trim() || text.length > 8192) {
    return false
  }
  const method = 'agentSession.appendVoiceText'
  const fields = { ...agentSessionVoiceStopFields(owner), text: text.trim() }
  try {
    const result = await callRuntimeRpc<AgentSessionMutationResult<AgentSessionVoiceTextResult>>(
      target,
      method,
      {
        envelope: {
          sessionId,
          clientOperationId: structuredSessionOperationId(),
          expectedRuntimeFence: fence,
          payloadFingerprint: structuredAgentSessionPayloadFingerprint({
            method,
            sessionId,
            fields
          })
        },
        ...fields
      },
      options
    )
    return (
      result.ok &&
      result.value.applied &&
      result.value.voiceSessionId === owner.voiceSessionId &&
      result.value.generation === owner.generation
    )
  } catch {
    // Older hosts and uncertain deliveries leave the local notice visible; never retry blindly.
    return false
  }
}
