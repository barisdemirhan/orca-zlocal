import {
  AGENT_CHAT_PERMISSION_MODE_OPTION_ID,
  type AgentChatPermissionMode
} from '../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import {
  normalizeAgentHubOrbSettings,
  resolveAgentHubOrbMode
} from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'

/** Orb's mode for the chat; null for an agent whose chats offer no modes. */
export function agentHubOrbPermissionMode(
  settings: AgentHubSettings,
  agent: string
): AgentChatPermissionMode | null {
  return resolveAgentHubOrbMode(agent, normalizeAgentHubOrbSettings(settings).permission)
}

/** The create option that fixes the Orb chat's mode, so Agent Permissions never decides it. */
export function agentHubOrbPermissionOptions(
  settings: AgentHubSettings,
  agent: string
): Record<string, string> {
  const mode = agentHubOrbPermissionMode(settings, agent)
  return mode ? { [AGENT_CHAT_PERMISSION_MODE_OPTION_ID]: mode } : {}
}

export const ORB_ACCESS_RANK = {
  ask: 0,
  'accept-edits': 1,
  auto: 2,
  'full-access': 3
} as const

// Why: a choice never made resolves to Approve for me or Ask, so it ranks at most with Approve for me.
export function agentHubOrbAccessRank(
  permission: ReturnType<typeof normalizeAgentHubOrbSettings>['permission']
): number {
  return permission ? ORB_ACCESS_RANK[permission] : ORB_ACCESS_RANK.auto
}
