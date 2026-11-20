import type { AgentHubCaller, AgentHubPane } from '../../../shared/agent-hub-requests'

export function agentHubTargetNeedsConsent(
  caller: AgentHubCaller,
  target: AgentHubPane,
  parentOf: (paneKey: string) => string | undefined = () => undefined
): boolean {
  const seen = new Set<string>()
  for (let pane: string | undefined = target.paneKey; pane; pane = parentOf(pane)) {
    if (pane === caller.paneKey) {
      return false
    }
    if (seen.has(pane)) {
      break
    }
    seen.add(pane)
  }
  return true
}
