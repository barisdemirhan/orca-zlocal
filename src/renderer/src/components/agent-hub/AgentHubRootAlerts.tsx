import { AgentHubAlertStack, type AgentHubAlertSide } from './AgentHubAlertStack'
import type { AgentHubAlert } from './agent-hub-alerts'
import { dismissAgentHubAlert } from './agent-hub-alert-queue'
import { agentHubRequestKey } from './agent-hub-requests-store'
import {
  threadOpenRequest,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import type { AgentHubOpenRequest } from './AgentHubPanel'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'

export function AgentHubRootAlerts({
  alerts,
  anchorRef,
  side,
  locationOf,
  requestPresentationOf,
  onOpenCard,
  onOpenMirror,
  onJump
}: {
  alerts: readonly AgentHubAlert[]
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
  onOpenCard: (key: string) => void
  onOpenMirror: (request: AgentHubOpenRequest) => void
  onJump: (request: AgentHubOpenRequest) => void
}): React.JSX.Element {
  const navigate = (alert: AgentHubAlert, action: (request: AgentHubOpenRequest) => void): void => {
    if (alert.thread) {
      dismissAgentHubAlert(alert.id)
      action(threadOpenRequest(alert.thread))
    }
  }
  return (
    <AgentHubAlertStack
      alerts={alerts}
      anchorRef={anchorRef}
      side={side}
      locationOf={(alert) =>
        alert.request
          ? requestPresentationOf(alert.host, alert.request).location
          : locationOf(alert.thread)
      }
      requestPresentationOf={(alert) => requestPresentationOf(alert.host, alert.request)}
      onOpen={(alert) => {
        if (alert.bot) {
          return
        }
        if (alert.request) {
          onOpenCard(agentHubRequestKey(alert.host, alert.request.requestId))
        } else if (alert.kind !== 'done') {
          onOpenCard(alert.thread.paneKey)
        } else {
          navigate(alert, onOpenMirror)
        }
      }}
      onPopout={(alert) => navigate(alert, onOpenMirror)}
      onJump={(alert) => navigate(alert, onJump)}
      onDismiss={dismissAgentHubAlert}
      answerKeys
    />
  )
}
