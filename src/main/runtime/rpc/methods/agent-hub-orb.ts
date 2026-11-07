import { defineMethod, type RpcContext } from '../core'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import {
  AgentHubOrbOpenParamsSchema,
  AgentHubOrbListParamsSchema,
  AgentHubOrbReleaseOperationParamsSchema
} from '../../../../shared/agent-hub-orb-params'
import { requireStructuredCapability } from './structured-sessions/creation/structured-agent-session-gate'

function orbFor(ctx: RpcContext, cleanup = false) {
  if (!cleanup) {
    ctx.runtime.agentHubOrb.requireEnabled()
  }
  if (ctx.caller?.kind === 'paired-device' || ctx.clientKind === 'mobile') {
    throw new AgentHubError('disabled', 'Agent Hub Orb is unavailable to paired clients')
  }
  requireStructuredCapability(ctx)
  return ctx.runtime.agentHubOrb
}

export const AGENT_HUB_ORB_METHODS = [
  defineMethod({
    name: 'agentHub.orb.close',
    permission: 'workspace',
    params: null,
    handler: async (_params, ctx) => {
      await orbFor(ctx, true).close()
      return null
    }
  }),
  defineMethod({
    name: 'agentHub.orb.open',
    permission: 'workspace',
    params: AgentHubOrbOpenParamsSchema,
    handler: (params, ctx) => orbFor(ctx).open(params)
  }),
  defineMethod({
    name: 'agentHub.orb.current',
    permission: 'workspace',
    params: null,
    handler: async (_params, ctx) => {
      const orb = orbFor(ctx)
      await ctx.runtime.ensureStructuredAgentSessionHost()
      return orb.current()
    }
  }),
  defineMethod({
    name: 'agentHub.orb.list',
    permission: 'workspace',
    params: AgentHubOrbListParamsSchema,
    handler: (params, ctx) => orbFor(ctx).list(params.limit)
  }),
  defineMethod({
    name: 'agentHub.orb.releaseOperation',
    permission: 'workspace',
    params: AgentHubOrbReleaseOperationParamsSchema,
    handler: (params, ctx) => {
      if (ctx.caller?.kind !== 'desktop' && ctx.caller?.kind !== 'paired-device') {
        throw new AgentHubError('invalid_argument', 'Take control from the target pane.')
      }
      return { released: ctx.runtime.agentHub.orbOperations.release(params.operationId) }
    }
  })
] as const
