import type { AgentHubSettings } from './agent-hub-settings'
import { isStructuredAgentId } from './agent-session-provider-handle'

export const AGENT_HUB_ORB_PI_PERMISSION_REASON =
  'Pi requires Act freely. Choose another agent to ask before running commands.'

export function agentHubOrbSupportsAsk(agent: string): boolean {
  return agent !== 'pi'
}

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
