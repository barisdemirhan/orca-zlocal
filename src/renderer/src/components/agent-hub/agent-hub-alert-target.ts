import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { AgentHubAlert } from './agent-hub-alerts'
import { agentHubTargetShowsThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { agentHubRequestHost, agentHubTargetPane } from './agent-hub-request-target'
import { shownAgentHubMirrorTarget, type AgentHubMirrorTab } from './agent-hub-mirror-membership'

export function agentHubAlertMatchesTarget(
  alert: AgentHubAlert,
  target: AgentHubPaneTarget
): boolean {
  if (!alert.request) {
    return agentHubTargetShowsThread(target, alert.thread)
  }
  const state = useAppStore.getState()
  if (agentHubRequestHost(state, target.worktree) !== alert.host) {
    return false
  }
  const caller = alert.request.caller
  const pane = agentHubTargetPane(state, target)
  return (
    target.paneKey === caller.paneKey ||
    pane?.terminalHandle === caller.terminalHandle ||
    (target.paneKey === null && parsePaneKey(caller.paneKey)?.tabId === target.tab.id)
  )
}

export function agentHubAlertMatchesMirrorTab(
  alert: AgentHubAlert,
  tab: AgentHubMirrorTab
): boolean {
  return (
    agentHubAlertMatchesTarget(alert, tab.target) ||
    agentHubAlertMatchesTarget(alert, shownAgentHubMirrorTarget(tab))
  )
}
