import {
  isAgentStatusHooksEnabledForAgent,
  type AgentStatusHooksSettings
} from '../../../shared/agent-hook-listener/configuration/agent-status-hooks-setting'

export type HubAnswerAgent = 'claude' | 'codex'

// Membership records mid-turn terminal input support until capability data covers it.
export const HUB_ANSWER_AGENTS = ['claude', 'codex'] as const satisfies readonly HubAnswerAgent[]

export function admitHubAnswerAgent(
  settings: AgentStatusHooksSettings,
  agent: string
): agent is HubAnswerAgent {
  return HUB_ANSWER_AGENTS.some(
    (candidate) => candidate === agent && isAgentStatusHooksEnabledForAgent(settings, candidate)
  )
}
