import { AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY } from '../../../../shared/agent-session-voice'
import { agentSessionRefusalError } from '../../../../shared/agent-session/failures/agent-session-wire-refusals'
import {
  StartVoiceParams,
  AppendVoiceTextParams,
  StopVoiceParams,
  SubscribeVoiceParams,
  VoiceCapabilityParams
} from '../../../../shared/rpc-contract/structured-agent-session-voice-params'
import { defineMethod, defineStreamingMethod, type RpcContext } from '../core'
import {
  requireInstalledStructuredHost,
  requireStructuredCleanupHost,
  requireStructuredCapability,
  structuredCallerFor
} from './structured-sessions/creation/structured-agent-session-gate'
import { bindStructuredAgentSessionStream } from './structured-sessions/subscriptions/structured-agent-session-status-stream'
import { structuredAgentSessionSubscriptionId } from './structured-sessions/subscriptions/structured-agent-session-subscription-id'

function requireVoiceClient(ctx: RpcContext): void {
  requireStructuredCapability(ctx)
  if (
    ctx.clientKind === 'mobile' ||
    ctx.caller?.kind === 'paired-device' ||
    (ctx.clientKind !== undefined &&
      !ctx.clientCapabilities?.includes(AGENT_SESSION_CODEX_VOICE_RUNTIME_CAPABILITY))
  ) {
    throw agentSessionRefusalError('structured_agent_session_unsupported', {
      reason: 'clientCapabilityMissing'
    })
  }
}

function voiceCaller(ctx: RpcContext) {
  return { ...structuredCallerFor(ctx), connectionId: ctx.connectionId }
}

export const STRUCTURED_AGENT_SESSION_VOICE_METHODS = [
  defineMethod({
    name: 'agentSession.appendVoiceText',
    permission: 'workspace',
    params: AppendVoiceTextParams,
    handler: async (params, ctx) => {
      requireVoiceClient(ctx)
      const host = await requireInstalledStructuredHost(ctx, params.envelope.sessionId)
      return host.voice.appendText(voiceCaller(ctx), params)
    }
  }),
  defineMethod({
    name: 'agentSession.voiceCapability',
    permission: 'workspace',
    params: VoiceCapabilityParams,
    handler: async (params, ctx) => {
      if (ctx.caller?.kind === 'paired-device') {
        requireStructuredCapability(ctx)
        return {
          supported: false as const,
          reason:
            'Live voice is not available on paired devices. Open this conversation on the host.'
        }
      }
      requireVoiceClient(ctx)
      return (await requireInstalledStructuredHost(ctx, params.sessionId)).voice.capability(
        params.sessionId
      )
    }
  }),
  defineMethod({
    name: 'agentSession.startVoice',
    permission: 'workspace',
    params: StartVoiceParams,
    handler: async (params, ctx) => {
      requireVoiceClient(ctx)
      const host = await requireInstalledStructuredHost(ctx, params.envelope.sessionId)
      return host.voice.start(voiceCaller(ctx), params)
    }
  }),
  defineMethod({
    name: 'agentSession.stopVoice',
    permission: 'workspace',
    params: StopVoiceParams,
    handler: async (params, ctx) => {
      requireVoiceClient(ctx)
      return requireStructuredCleanupHost(ctx).voice.stop(voiceCaller(ctx), params)
    }
  }),
  defineStreamingMethod({
    name: 'agentSession.subscribeVoice',
    permission: 'workspace',
    params: SubscribeVoiceParams,
    handler: async (params, ctx, emit) => {
      requireVoiceClient(ctx)
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      const id = `voice:${structuredAgentSessionSubscriptionId(ctx, params.sessionId)}`
      let dispose = (): void => {}
      const stream = bindStructuredAgentSessionStream(ctx, id, () => dispose())
      if (stream.isClosed()) {
        return
      }
      dispose = host.voice.subscribe({
        ...params,
        id,
        ...voiceCaller(ctx),
        emit
      })
      if (stream.isClosed()) {
        dispose()
      }
    }
  })
]
