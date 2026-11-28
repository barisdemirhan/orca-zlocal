import { invalidAgentSessionVoiceOperation as invalid } from './structured-agent-session-voice-refusal'
import {
  agentSessionVoiceStartFields,
  agentSessionVoiceStopFields,
  type AgentSessionVoiceCapability,
  type AgentSessionVoiceEvent,
  type AgentSessionVoiceOwner,
  type AgentSessionVoiceResult,
  type AgentSessionVoiceStartParams,
  type AgentSessionVoiceStopParams,
  type AgentSessionVoiceTextParams
} from '../../../shared/agent-session-voice'
import type { StructuredAgentSessionCaller } from './host/structured-agent-session-host-types'
import {
  mutateStructuredAgentSession,
  runStructuredAgentSessionMutation,
  type StructuredAgentSessionMutationContext
} from './operations/structured-agent-session-mutation-context'
import { openForProviderWrite } from './operations/structured-agent-session-send-preparation'
import { runWithReadyStructuredAgentSessionOperation } from './operations/structured-agent-session-ready-operation'
import { openWithReadyStructuredAgentSessionChild } from './operations/structured-agent-session-operation-child'
import { codexVoiceTargetCapability } from './structured-agent-session-voice-capability'
import type { MutationPlan } from './operations/structured-agent-session-mutation-plans'
import {
  appendStructuredVoiceText,
  ownsVoiceTextAttempt
} from './structured-agent-session-voice-text'

type Subscriber = AgentSessionVoiceOwner & {
  id: string
  sessionId: string
  callerKey: string
  connectionId?: string
  emit: (event: AgentSessionVoiceEvent) => void
}
type ActiveVoice = AgentSessionVoiceOwner & {
  callerKey: string
  connectionId?: string
  fence: number
}
type VoiceCaller = StructuredAgentSessionCaller & { connectionId?: string }

export type StructuredAgentSessionVoiceProviderEvent = {
  sessionId: string
  fence: number
  acquisitionGeneration: string
  event: AgentSessionVoiceEvent
}

/** Ephemeral signalling addressed to the caller that owns one exact voice attempt. */
export class StructuredAgentSessionVoice {
  private readonly subscribers = new Map<string, Subscriber>()
  private readonly active = new Map<string, ActiveVoice>()

  constructor(private readonly context: () => StructuredAgentSessionMutationContext) {}

  private targetCapability = (sessionId: string): AgentSessionVoiceCapability =>
    codexVoiceTargetCapability(this.context().deps, sessionId)

  capability = async (sessionId: string): Promise<AgentSessionVoiceCapability> => {
    const target = this.targetCapability(sessionId)
    if (target.supported !== true) {
      return target
    }
    return (
      this.context().deps.adapter.voice?.capability(sessionId) ?? {
        supported: null,
        reason: 'Native voice support has not been checked for this conversation.'
      }
    )
  }

  subscribe = (input: Subscriber): (() => void) => {
    this.subscribers.set(input.id, input)
    input.emit({
      type: 'ready',
      sessionId: input.sessionId,
      voiceSessionId: input.voiceSessionId,
      generation: input.generation
    })
    return () => {
      if (this.subscribers.get(input.id) !== input) {
        return
      }
      this.subscribers.delete(input.id)
      if (!this.hasSubscriber(input.sessionId, input, input)) {
        void this.stopAbandoned(input).catch(() => {})
      }
    }
  }

  start = (caller: VoiceCaller, params: AgentSessionVoiceStartParams) => {
    const context = this.context()
    const sessionId = params.envelope.sessionId
    const beforeStart = () => {
      const capability = this.targetCapability(sessionId)
      if (capability.supported !== true) {
        return invalid(capability.reason)
      }
      return this.hasSubscriber(sessionId, params, caller)
        ? { ok: true as const }
        : invalid('Open the voice signalling stream before starting Live.')
    }
    const plan: MutationPlan<AgentSessionVoiceResult> = {
      method: 'agentSession.startVoice',
      fields: agentSessionVoiceStartFields(params),
      run: async (ctx) => {
        const admitted = beforeStart()
        if (!admitted.ok) {
          return admitted
        }
        if (!ctx.adapter.voice) {
          return invalid('Live voice is unavailable for this provider.')
        }
        const current = this.active.get(sessionId)
        if (current && ctx.adapter.voice.holds(sessionId)) {
          if (this.hasSubscriber(sessionId, current, current)) {
            return invalid('The previous Live connection has not been confirmed closed.')
          }
          const stopped = await this.stopOwned(sessionId, current, current, ctx.fence)
          if (stopped.state !== 'off' || ctx.adapter.voice.holds(sessionId)) {
            return invalid('The previous Live connection is still closing. Try again shortly.')
          }
        }
        const owner: ActiveVoice = {
          voiceSessionId: params.voiceSessionId,
          generation: params.generation,
          callerKey: caller.callerKey,
          connectionId: caller.connectionId,
          fence: ctx.fence
        }
        this.active.set(sessionId, owner)
        const result = await ctx.adapter.voice.start({
          sessionId,
          fence: ctx.fence,
          voiceSessionId: params.voiceSessionId,
          generation: params.generation,
          sdp: params.sdp
        })
        if (!result.ok) {
          if (this.active.get(sessionId) === owner) {
            this.active.delete(sessionId)
          }
          return invalid(result.rejected)
        }
        return result
      },
      // A recorded start is never sent again, including a crash before its response arrived.
      replay: () => ({
        voiceSessionId: params.voiceSessionId,
        generation: params.generation,
        state: 'unverifiable'
      })
    }
    return runWithReadyStructuredAgentSessionOperation(
      context,
      caller.callerKey,
      params.envelope,
      plan,
      (selection) =>
        runStructuredAgentSessionMutation(
          context,
          caller,
          params.envelope,
          plan,
          openWithReadyStructuredAgentSessionChild(context, params.envelope, selection)
        ),
      {
        beforeAgent: () => {
          const admitted = beforeStart()
          return admitted.ok ? null : admitted
        }
      }
    )
  }

  stop = (caller: VoiceCaller, params: AgentSessionVoiceStopParams) => {
    const context = this.context()
    const sessionId = params.envelope.sessionId
    const plan: MutationPlan<AgentSessionVoiceResult> = {
      method: 'agentSession.stopVoice',
      fields: agentSessionVoiceStopFields(params),
      conversationWrite: true,
      run: async (ctx) => ({
        ok: true,
        value: await this.stopOwned(sessionId, params, caller, ctx.fence)
      }),
      replay: () => ({
        voiceSessionId: params.voiceSessionId,
        generation: params.generation,
        state: this.context().deps.adapter.voice?.holds(sessionId) ? 'unverifiable' : 'off'
      })
    }
    return mutateStructuredAgentSession(
      context,
      caller,
      params.envelope,
      plan,
      openForProviderWrite(context, params.envelope)
    )
  }

  appendText = (caller: VoiceCaller, params: AgentSessionVoiceTextParams) =>
    appendStructuredVoiceText(this.context(), caller, params, (fence) => {
      return (
        ownsVoiceTextAttempt(this.active.get(params.envelope.sessionId), params, caller, fence) &&
        this.hasSubscriber(params.envelope.sessionId, params, caller)
      )
    })

  publish = (input: StructuredAgentSessionVoiceProviderEvent): void => {
    const context = this.context()
    const child = context.sessions.get(input.sessionId)?.child
    const owner = this.active.get(input.sessionId)
    if (
      !owner ||
      input.event.sessionId !== input.sessionId ||
      !this.matches(owner, input.event) ||
      owner.fence !== input.fence ||
      child?.fence !== input.fence ||
      child.generation !== input.acquisitionGeneration ||
      context.deps.store.getRecord(input.sessionId)?.lease.runtimeFence !== input.fence
    ) {
      return
    }
    for (const subscriber of this.subscribers.values()) {
      if (
        subscriber.sessionId !== input.sessionId ||
        subscriber.callerKey !== owner.callerKey ||
        subscriber.connectionId !== owner.connectionId ||
        !this.matches(subscriber, input.event)
      ) {
        continue
      }
      try {
        subscriber.emit(input.event)
      } catch {
        this.subscribers.delete(subscriber.id)
        void this.stopAbandoned(subscriber).catch(() => {})
      }
    }
    if (input.event.type === 'closed' && this.active.get(input.sessionId) === owner) {
      this.active.delete(input.sessionId)
    }
  }

  private hasSubscriber(
    sessionId: string,
    owner: AgentSessionVoiceOwner,
    caller: VoiceCaller
  ): boolean {
    return [...this.subscribers.values()].some(
      (subscriber) =>
        subscriber.sessionId === sessionId &&
        subscriber.callerKey === caller.callerKey &&
        subscriber.connectionId === caller.connectionId &&
        this.matches(subscriber, owner)
    )
  }

  private async stopAbandoned(input: Subscriber): Promise<void> {
    const context = this.context()
    await context.serialize(input.sessionId, async () => {
      if (this.hasSubscriber(input.sessionId, input, input)) {
        return
      }
      const owner = this.active.get(input.sessionId)
      if (owner && this.matches(owner, input)) {
        await this.stopOwned(input.sessionId, input, input, owner.fence)
      }
    })
  }

  private async stopOwned(
    sessionId: string,
    requested: AgentSessionVoiceOwner,
    caller: VoiceCaller,
    fence: number
  ): Promise<AgentSessionVoiceResult> {
    const owner = this.active.get(sessionId)
    if (
      !owner ||
      !this.matches(owner, requested) ||
      owner.callerKey !== caller.callerKey ||
      owner.connectionId !== caller.connectionId ||
      owner.fence !== fence
    ) {
      return {
        voiceSessionId: requested.voiceSessionId,
        generation: requested.generation,
        state: 'off'
      }
    }
    const result = (await this.context().deps.adapter.voice?.stop({
      sessionId,
      fence,
      ...requested
    })) ?? {
      voiceSessionId: requested.voiceSessionId,
      generation: requested.generation,
      state: 'unverifiable' as const
    }
    if (result.state === 'off' && this.active.get(sessionId) === owner) {
      this.active.delete(sessionId)
    }
    return result
  }

  private matches(left: AgentSessionVoiceOwner, right: AgentSessionVoiceOwner): boolean {
    return left.voiceSessionId === right.voiceSessionId && left.generation === right.generation
  }
}
