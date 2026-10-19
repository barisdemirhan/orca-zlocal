import {
  agentChatPermissionModes,
  effectiveChatPermissionMode,
  isAgentChatPermissionMode,
  offeredChatPermissionModes,
  type AgentChatPermissionMode
} from './agent-chat-permission-mode'
import type { AgentHubOrbAction, AgentHubSettings } from './agent-hub-settings'
import { isStructuredAgentId } from './agent-session-provider-handle'

export const AGENT_HUB_ORB_PI_PERMISSION_REASON =
  'Pi requires Full access. Choose another agent to ask before running commands.'

export function agentHubOrbSupportsAsk(agent: string): boolean {
  return agent !== 'pi'
}

/** The saved choice as a chat mode; null when never chosen. `free` is the stored name of Full access,
 *  kept so older peers still read it; they read the newer values as Ask. */
export function agentHubOrbChosenMode(saved: unknown): AgentChatPermissionMode | null {
  return saved === 'free' ? 'full-access' : isAgentChatPermissionMode(saved) ? saved : null
}

export function agentHubOrbPermissionSettingValue(
  mode: AgentChatPermissionMode
): NonNullable<AgentHubSettings['agentHubOrbPermission']> {
  return mode === 'full-access' ? 'free' : mode
}

/** The modes Orb offers for an agent; an agent without modes only runs freely or asks. */
export function agentHubOrbOfferedModes(
  agent: string,
  autoSupported: boolean
): readonly AgentChatPermissionMode[] {
  const support = agentChatPermissionModes(agent)
  return support
    ? offeredChatPermissionModes(support, autoSupported)
    : agentHubOrbSupportsAsk(agent)
      ? ['ask', 'full-access']
      : ['full-access']
}

/** The mode Orb's chat runs: the user's choice, else Approve for me, else Full access, else Ask.
 *  Null for an agent whose chats offer no modes. */
export function resolveAgentHubOrbMode(
  agent: string,
  chosen: AgentChatPermissionMode | null,
  autoSupported: boolean
): AgentChatPermissionMode | null {
  const support = agentChatPermissionModes(agent)
  if (!support) {
    return null
  }
  if (chosen) {
    return effectiveChatPermissionMode(support, chosen, autoSupported)
  }
  const offered = offeredChatPermissionModes(support, autoSupported)
  return offered.includes('auto') ? 'auto' : offered.includes('full-access') ? 'full-access' : 'ask'
}

export function normalizeAgentHubOrbSettings(settings: AgentHubSettings) {
  return {
    agent: isStructuredAgentId(settings.agentHubOrbAgent) ? settings.agentHubOrbAgent : 'claude',
    model:
      typeof settings.agentHubOrbModel === 'string'
        ? settings.agentHubOrbModel.trim() || null
        : null,
    permission: agentHubOrbChosenMode(settings.agentHubOrbPermission),
    cwd: typeof settings.agentHubOrbCwd === 'string' ? settings.agentHubOrbCwd.trim() || null : null
  }
}

export function agentHubOrbLaunchAction(
  settings: AgentHubSettings | null | undefined,
  alternate = false
): AgentHubOrbAction {
  const action = alternate
    ? settings?.agentHubOrbAlternateAction
    : settings?.agentHubOrbDefaultAction
  if (action === 'live' || action === 'dictate' || action === 'text') {
    return action
  }
  return alternate ? 'text' : settings?.agentHubOrbAgent === 'codex' ? 'live' : 'dictate'
}
