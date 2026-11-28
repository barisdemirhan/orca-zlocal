import type { AgentSessionPluginClientCaller } from '../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-client-wire'
import type { AgentSessionPluginUiAction } from '../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

/** A provider mod's surfaces: a press, layout change or pane close (redraws arrive as plugin surface
 *  updates), and a surface runtime's request for a mod's `Client` regions. */
export type StructuredAgentSessionPluginUiAdapter = {
  act(sessionId: string, action: AgentSessionPluginUiAction): Promise<void>
  callClient: AgentSessionPluginClientCaller
}

/** Routes mod surface calls to the session's live provider adapter. */
export function routeStructuredAgentSessionPluginUi(
  liveOwner: (sessionId: string) => { pluginUi?: StructuredAgentSessionPluginUiAdapter } | null
): StructuredAgentSessionPluginUiAdapter {
  return {
    act: async (id, action) => liveOwner(id)?.pluginUi?.act(id, action),
    callClient: async (id, call) => (await liveOwner(id)?.pluginUi?.callClient(id, call)) ?? null
  }
}
