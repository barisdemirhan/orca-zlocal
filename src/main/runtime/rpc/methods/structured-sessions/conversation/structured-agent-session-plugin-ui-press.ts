import { PluginUiPressParams } from '../../../../../../shared/rpc-contract/structured-agent-session/plugin-ui-press-params'
import { defineMethod } from '../../../core'
import { requireInstalledStructuredHost } from '../creation/structured-agent-session-gate'

export const STRUCTURED_AGENT_SESSION_PLUGIN_UI_PRESS_METHODS = [
  defineMethod({
    name: 'agentSession.pluginUiPress',
    permission: 'workspace',
    params: PluginUiPressParams,
    handler: async (params, ctx) => {
      const host = await requireInstalledStructuredHost(ctx, params.sessionId)
      const { sessionId, ...press } = params
      await host.reads.pressPluginUi(sessionId, press)
      return { ok: true as const }
    }
  })
]
