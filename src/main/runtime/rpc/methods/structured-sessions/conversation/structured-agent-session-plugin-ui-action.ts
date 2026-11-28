import { PluginUiActionParams } from '../../../../../../shared/rpc-contract/structured-agent-session/plugin-ui-action-params'
import { defineMethod } from '../../../core'
import { requireInstalledStructuredHost } from '../creation/structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_PLUGIN_UI_ACTION_METHODS = [
  defineMethod({
    name: 'agentSession.pluginUiAction',
    permission: 'workspace',
    params: PluginUiActionParams,
    handler: async (params, ctx) => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      await host.reads.actOnPluginUi(params.sessionId, params.action)
      return { ok: true as const }
    }
  })
]
