import type {
  AgentSessionVoiceTextParams,
  AgentSessionVoiceTextResult,
  AgentSessionVoiceOwner
} from '../../../shared/agent-session-voice'
import { refuse } from '../../../shared/agent-session/failures/agent-session-wire-refusals'
import type { StructuredAgentSessionCaller } from './host/structured-agent-session-host-types'
import {
  mutateStructuredAgentSession,
  type StructuredAgentSessionMutationContext
} from './operations/structured-agent-session-mutation-context'
import type { MutationPlan } from './operations/structured-agent-session-mutation-plans'
import { openForProviderWrite } from './operations/structured-agent-session-send-preparation'

export function ownsVoiceTextAttempt(
  active:
    | (AgentSessionVoiceOwner & { callerKey: string; connectionId?: string; fence: number })
    | undefined,
  requested: AgentSessionVoiceOwner,
  caller: StructuredAgentSessionCaller & { connectionId?: string },
  fence: number
): boolean {
  return Boolean(
    active &&
    active.voiceSessionId === requested.voiceSessionId &&
    active.generation === requested.generation &&
    active.callerKey === caller.callerKey &&
    active.connectionId === caller.connectionId &&
    active.fence === fence
  )
}

export function appendStructuredVoiceText(
  context: StructuredAgentSessionMutationContext,
  caller: StructuredAgentSessionCaller,
  params: AgentSessionVoiceTextParams,
  ownsAttempt: (fence: number) => boolean
) {
  const { voiceSessionId, generation, text } = params
  const owner = { voiceSessionId, generation }
  const plan: MutationPlan<AgentSessionVoiceTextResult> = {
    method: 'agentSession.appendVoiceText',
    fields: { ...owner, text },
    conversationWrite: true,
    run: async (ctx) => {
      if (!ownsAttempt(ctx.fence) || !ctx.adapter.voice) {
        return {
          ok: false,
          refusal: refuse(
            'agent_session_operation_invalid',
            { reason: 'providerRejected' },
            'Live context delivery is unavailable for this voice attempt.'
          )
        }
      }
      const applied = await ctx.adapter.voice.appendText({
        sessionId: params.envelope.sessionId,
        fence: ctx.fence,
        ...owner,
        text
      })
      return { ok: true, value: { ...owner, applied } }
    },
    // An uncertain delivery is never sent again by ledger replay.
    replay: () => ({ ...owner, applied: false })
  }
  return mutateStructuredAgentSession(
    context,
    caller,
    params.envelope,
    plan,
    openForProviderWrite(context, params.envelope)
  )
}
