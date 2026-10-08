import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { openAgentHubMirror } from './agent-hub-mirror-store'
import {
  addAgentHubMirrorTab,
  retargetAgentHubMirrorTab,
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

/** Retargets the window's active tab; only a terminal shown elsewhere is raised instead. */
export function selectAgentHubMirrorFamilyMember(
  windowId: string,
  tabId: string,
  target: AgentHubPaneTarget
): void {
  const result = retargetAgentHubMirrorTab(windowId, tabId, target)
  if (result.status === 'already-owned') {
    openAgentHubMirror(target)
  } else if (result.status === 'missing-source') {
    toast.error(
      translate('agentHub.mirror.addUnavailable', 'This terminal is no longer available to add.')
    )
  }
}
