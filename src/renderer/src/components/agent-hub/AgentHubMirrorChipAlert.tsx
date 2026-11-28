import { openAgentHubMirrorInLayout } from './agent-hub-floating-arrangement'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import { AgentHubAlertStack, type AgentHubAlertSide } from './AgentHubAlertStack'
import type { AgentHubAlert, AgentHubRequestAlert, AgentHubThreadAlert } from './agent-hub-alerts'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { paneTargetFromThread, type AgentHubLocation } from './agent-hub-pane-target'

/** The alert a minimized chip raises beside itself. */
export function AgentHubMirrorChipAlert({
  alert,
  anchorRef,
  alertSide,
  location,
  locationOfAlert,
  requestPresentationOf,
  onOpenAlert,
  onDismissAlert,
  onReveal
}: {
  alert: AgentHubAlert
  anchorRef: React.RefObject<HTMLElement | null>
  alertSide: AgentHubAlertSide
  location: AgentHubLocation
  locationOfAlert?: (alert: AgentHubThreadAlert | AgentHubRequestAlert) => AgentHubLocation
  requestPresentationOf?: (alert: AgentHubRequestAlert) => AgentHubRequestPresentation
  onOpenAlert: (alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
  onReveal: (alert?: AgentHubAlert) => void
}): React.JSX.Element {
  return (
    <AgentHubAlertStack
      // The chip shows the newest alert across its entries.
      alerts={[alert]}
      anchorRef={anchorRef}
      side={alertSide}
      locationOf={locationOfAlert ?? (() => location)}
      requestPresentationOf={requestPresentationOf}
      onOpen={onOpenAlert}
      onPopout={(shown) => {
        if (!shown.thread) {
          onOpenAlert(shown)
          return
        }
        onDismissAlert(shown.id)
        openAgentHubMirrorInLayout(
          paneTargetFromThread(shown.thread, activityThreadRowCopy(shown.thread).taskTitle)
        )
      }}
      onJump={(shown) => {
        onDismissAlert(shown.id)
        onReveal(shown)
      }}
      onDismiss={onDismissAlert}
    />
  )
}
