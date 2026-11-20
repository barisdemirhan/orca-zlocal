import type { AgentHubDefaultTab } from '../../../../shared/agent-hub-settings'

/** Waiting agents take priority over the user's starting tab. */
export function agentHubInitialTab(
  defaultTab: AgentHubDefaultTab,
  waitingCount: number
): AgentHubDefaultTab {
  return waitingCount > 0 ? 'inbox' : defaultTab
}
