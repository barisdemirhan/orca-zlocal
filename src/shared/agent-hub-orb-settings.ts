import type { AgentHubSettings } from './agent-hub-settings'
import { isStructuredAgentId } from './agent-session-provider-handle'

export function normalizeAgentHubOrbSettings(settings: AgentHubSettings) {
  return {
    agent: isStructuredAgentId(settings.agentHubOrbAgent) ? settings.agentHubOrbAgent : 'claude',
    model:
      typeof settings.agentHubOrbModel === 'string'
        ? settings.agentHubOrbModel.trim() || null
        : null,
    permission: settings.agentHubOrbPermission === 'free' ? ('free' as const) : ('ask' as const),
    cwd: typeof settings.agentHubOrbCwd === 'string' ? settings.agentHubOrbCwd.trim() || null : null
  }
}
