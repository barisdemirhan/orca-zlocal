import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubTrayItem } from './AgentHubMirrorTray'
import type { AgentHubAlert, AgentHubRequestAlert, AgentHubThreadAlert } from './agent-hub-alerts'
import { dismissAgentHubAlert } from './agent-hub-alert-queue'
import { agentHubAlertMatchesMirrorTab } from './agent-hub-alert-target'
import { openAgentHubMirrorInLayout } from './agent-hub-floating-arrangement'
import { activeAgentHubMirrorTab, shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { releaseAgentHubMirrorShownTarget } from './agent-hub-mirror-viewing'
import { agentHubRequestKey } from './agent-hub-requests-store'
import {
  paneTargetFromThread,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

export function agentHubMirrorAlertTrayActions({
  locationOf,
  requestPresentationOf,
  onReveal,
  onOpenCard
}: {
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
  onOpenCard: (key: string) => void
}) {
  return {
    locationOfAlert: (alert: AgentHubThreadAlert | AgentHubRequestAlert) =>
      alert.request
        ? requestPresentationOf(alert.host, alert.request).location
        : locationOf(alert.thread),
    requestPresentationOf: (alert: AgentHubRequestAlert) =>
      requestPresentationOf(alert.host, alert.request),
    onReveal: (item: AgentHubTrayItem, alert?: AgentHubAlert): void => {
      const tab = alert
        ? item.chip.window.tabs.find((tab) => agentHubAlertMatchesMirrorTab(alert, tab))
        : activeAgentHubMirrorTab(item.chip.window)
      if (!tab) {
        return
      }
      releaseAgentHubMirrorShownTarget(item.key, tab.id)
      onReveal(
        alert?.thread
          ? paneTargetFromThread(alert.thread, activityThreadRowCopy(alert.thread).taskTitle)
          : shownAgentHubMirrorTarget(tab),
        alert?.thread ?? item.thread
      )
    },
    onOpenAlert: (_key: string, alert: AgentHubAlert): void => {
      if (alert.bot) {
        return
      }
      if (alert.request) {
        onOpenCard(agentHubRequestKey(alert.host, alert.request.requestId))
        return
      }
      dismissAgentHubAlert(alert.id)
      if (alert.kind === 'done') {
        openAgentHubMirrorInLayout(
          paneTargetFromThread(alert.thread, activityThreadRowCopy(alert.thread).taskTitle)
        )
      } else {
        onOpenCard(alert.thread.paneKey)
      }
    }
  }
}
