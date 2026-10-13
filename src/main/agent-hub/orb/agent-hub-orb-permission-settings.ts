import {
  AGENT_CHAT_PERMISSION_MODE_OPTION_ID,
  agentChatPermissionModes,
  type AgentChatPermissionMode
} from '../../../shared/agent-chat-permission-mode'
import { normalizeAgentHubOrbSettings } from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'

/** Orb's choice as the chat's own permission mode; null for an agent whose chats offer no modes. */
export function agentHubOrbPermissionMode(
  settings: AgentHubSettings,
  agent: string
): AgentChatPermissionMode | null {
  if (!agentChatPermissionModes(agent)) {
    return null
  }
  return normalizeAgentHubOrbSettings(settings).permission === 'free' ? 'full-access' : 'ask'
}

/** The create option that fixes the Orb chat's mode, so Agent Permissions never decides it. */
export function agentHubOrbPermissionOptions(
  settings: AgentHubSettings,
  agent: string
): Record<string, string> {
  const mode = agentHubOrbPermissionMode(settings, agent)
  return mode ? { [AGENT_CHAT_PERMISSION_MODE_OPTION_ID]: mode } : {}
}
