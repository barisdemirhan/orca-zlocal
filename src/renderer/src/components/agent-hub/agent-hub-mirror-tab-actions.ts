import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { readAgentHubMirrors, openAgentHubMirror } from './agent-hub-mirror-store'
import {
  addAgentHubMirrorTab,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

export function agentHubMirrorTabCapReason(): string {
  return translate('agentHub.mirror.tabLimit', 'A mirror can hold up to 10 terminals.')
}

export function addAgentHubMirrorTabWithFeedback(
  windowId: string,
  target: AgentHubPaneTarget
): AgentHubMirrorTabResult {
  const result = addAgentHubMirrorTab(windowId, target)
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

export function selectAgentHubMirrorFamilyMember(
  windowId: string,
  target: AgentHubPaneTarget
): void {
  if (findAgentHubMirrorMembership(readAgentHubMirrors(), target)) {
    openAgentHubMirror(target)
  } else {
    addAgentHubMirrorTabWithFeedback(windowId, target)
  }
}
