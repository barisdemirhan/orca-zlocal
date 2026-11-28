import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { showAgentHubMirrorMember } from './agent-hub-mirror-member-navigation'
import { toggleAgentHubMirrorViewing } from './agent-hub-mirror-viewing'
import {
  addAgentHubMirrorTab,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

export function agentHubMirrorTabCapReason(): string {
  return translate('agentHub.mirror.tabLimit', 'A mirror can hold up to 10 terminals.')
}

export function addAgentHubMirrorTabWithFeedback(
  windowId: string,
  target: AgentHubPaneTarget,
  focusTerminal = true
): AgentHubMirrorTabResult {
  const result = addAgentHubMirrorTab(windowId, target, focusTerminal)
  if (result.status === 'tab-cap') {
    toast.error(agentHubMirrorTabCapReason())
  } else if (result.status === 'already-owned') {
    toast.error(translate('agentHub.mirror.alreadyOwned', 'This terminal is already popped out.'))
  } else if (result.status !== 'changed') {
    toast.error(
      translate('agentHub.mirror.addUnavailable', 'This terminal is no longer available to add.')
    )
  }
  return result
}

/** Family navigation borrows a terminal while keeping the tab's home identity. */
export function selectAgentHubMirrorFamilyMember(
  windowId: string,
  tabId: string,
  target: AgentHubPaneTarget
): void {
  const result = toggleAgentHubMirrorViewing(windowId, tabId, target)
  if (result.status === 'already-owned') {
    showAgentHubMirrorMember(target)
  } else if (result.status === 'missing-source') {
    toast.error(
      translate('agentHub.mirror.addUnavailable', 'This terminal is no longer available to add.')
    )
  }
}
