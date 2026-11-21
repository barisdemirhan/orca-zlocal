import { PluginUiClientParams } from '../../../../../../shared/rpc-contract/structured-agent-session/plugin-ui-client-params'
import { defineMethod } from '../../../core'
import { requireInstalledStructuredHost } from '../creation/structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_PLUGIN_UI_CLIENT_METHODS = [
  defineMethod({
    name: 'agentSession.pluginUiClient',
    permission: 'workspace',
    params: PluginUiClientParams,
    handler: async (params, ctx) => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      return { answer: await host.reads.callPluginUiClient(params.sessionId, params.call) }
    }
  })
]
