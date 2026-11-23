import { AgentHubAlertStack, type AgentHubAlertSide } from './AgentHubAlertStack'
import type { AgentHubAlert, AgentHubRequestAlert } from './agent-hub-alerts'
import { openAgentHubBotCaller } from './agent-hub-bot-caller-open'
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

/** A bot chat's card opens that chat; a notice it raised is read once opened. */
function openBotCaller(alert: AgentHubRequestAlert): boolean {
  if (!openAgentHubBotCaller(alert.host, alert.request.caller)) {
    return false
  }
  if (alert.request.kind === 'notify') {
    dismissAgentHubAlert(alert.id)
  }
  return true
}

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
    } else if (alert.request) {
      openBotCaller(alert)
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
          if (!openBotCaller(alert)) {
            onOpenCard(agentHubRequestKey(alert.host, alert.request.requestId))
          }
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
