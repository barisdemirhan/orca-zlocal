import {
  AGENT_CHAT_PERMISSION_MODE_OPTION_ID,
  agentChatPermissionModes,
  chatModelSupportsAutoMode,
  type AgentChatPermissionMode
} from '../../../shared/agent-chat-permission-mode'
import {
  normalizeAgentHubOrbSettings,
  resolveAgentHubOrbMode
} from '../../../shared/agent-hub-orb-settings'
import type { AgentHubSettings } from '../../../shared/agent-hub-settings'
import type { StructuredAgentSessionHostDeps } from '../../native-chat/agent-session-wire/structured-agent-session-host-types'

/** Orb's mode for the chat; null for an agent whose chats offer no modes. */
export function agentHubOrbPermissionMode(
  settings: AgentHubSettings,
  agent: string,
  autoSupported = false
): AgentChatPermissionMode | null {
  return resolveAgentHubOrbMode(
    agent,
    normalizeAgentHubOrbSettings(settings).permission,
    autoSupported
  )
}

/** Saved catalog only, so opening Orb never waits on a model listing. */
export async function agentHubOrbAutoModeSupported(
  catalog: StructuredAgentSessionHostDeps['modelCatalog'],
  agent: string,
  model: string | null
): Promise<boolean> {
  const support = agentChatPermissionModes(agent)
  if (!support?.modes.includes('auto')) {
    return false
  }
  if (!support.autoNeedsModelSupport) {
    return true
  }
  const listing = await catalog?.read({ agent, savedOnly: true }).catch(() => null)
  return (
    listing !== null &&
    listing !== undefined &&
    listing.origin !== 'unknown' &&
    chatModelSupportsAutoMode(listing.models, model)
  )
}

/** The create option that fixes the Orb chat's mode, so Agent Permissions never decides it. */
export function agentHubOrbPermissionOptions(
  settings: AgentHubSettings,
  agent: string,
  autoSupported = false
): Record<string, string> {
  const mode = agentHubOrbPermissionMode(settings, agent, autoSupported)
  return mode ? { [AGENT_CHAT_PERMISSION_MODE_OPTION_ID]: mode } : {}
}
