import { agentChatPermissionModes } from './agent-launch/permissions/agent-chat-permission-support'
import {
  isAgentChatPermissionMode,
  savedChatPermissionMode,
  type AgentChatPermissionMode
} from './agent-launch/permissions/agent-chat-permission-mode'
import type { AgentHubOrbAction, AgentHubSettings } from './agent-hub-settings'
import {
  normalizeAgentHubOrbName,
  normalizeAgentHubOrbTint,
  normalizeAgentHubOrbTone
} from './agent-hub-orb-identity'
import { isStructuredAgentId } from './agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'

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
export function agentHubOrbOfferedModes(agent: string): readonly AgentChatPermissionMode[] {
  const support = agentChatPermissionModes(agent)
  return support
    ? support.modes
    : agentHubOrbSupportsAsk(agent)
      ? ['ask', 'full-access']
      : ['full-access']
}

/** The mode Orb's chat runs: the user's choice, else Approve for me, else Ask; never Full access without an explicit choice.
 *  Null for an agent whose chats offer no modes. */
export function resolveAgentHubOrbMode(
  agent: string,
  chosen: AgentChatPermissionMode | null
): AgentChatPermissionMode | null {
  const support = agentChatPermissionModes(agent)
  if (!support) {
    return null
  }
  if (chosen) {
    return savedChatPermissionMode(support, chosen)
  }
  return support.modes.includes('auto') ? 'auto' : 'ask'
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

export function normalizeAgentHubOrbIdentitySettings(settings: AgentHubSettings) {
  return {
    name: normalizeAgentHubOrbName(settings.agentHubOrbName),
    tone: normalizeAgentHubOrbTone(settings.agentHubOrbTone),
    tint: normalizeAgentHubOrbTint(settings.agentHubOrbTint),
    memorySuggestions: settings.agentHubOrbMemorySuggestions !== false
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
