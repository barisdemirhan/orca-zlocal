import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { AgentHubAlert } from './agent-hub-alerts'
import { agentHubTargetShowsThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { agentHubRequestHost, agentHubTargetPane } from './agent-hub-request-target'
import {
  agentHubMirrorWindowShowsThread,
  shownAgentHubMirrorTarget,
  type AgentHubMirrorState,
  type AgentHubMirrorTab
} from './agent-hub-mirror-membership'

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

/** The hub bubble's alerts: an open or minimized mirror raises its own pane's alerts. */
export function agentHubAlertsOutsideMirrors(
  alerts: readonly AgentHubAlert[],
  { windows, chips }: AgentHubMirrorState
): AgentHubAlert[] {
  return alerts.filter(
    (candidate) =>
      !chips.some((chip) =>
        chip.window.tabs.some((tab) => agentHubAlertMatchesMirrorTab(candidate, tab))
      ) &&
      (candidate.request ||
        !windows.some((window) => agentHubMirrorWindowShowsThread(window, candidate.thread)))
  )
}
