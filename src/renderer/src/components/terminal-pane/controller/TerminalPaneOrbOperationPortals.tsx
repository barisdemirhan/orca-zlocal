import { createPortal } from 'react-dom'
import { AgentHubOrbOperationOverlay } from '../../agent-hub/AgentHubOrbOperationOverlay'
import type { TerminalPaneController } from './use-terminal-pane-controller'

export function TerminalPaneOrbOperationPortals({
  controller
}: {
  controller: TerminalPaneController
}): React.JSX.Element {
  return (
    <>
      {controller.managedPanes.map((pane) => {
        const ptyId = controller.paneTransportsRef.current.get(pane.id)?.getPtyId()
        return ptyId
          ? createPortal(
              <AgentHubOrbOperationOverlay
                ptyId={ptyId}
                paneKey={`${controller.tabId}:${pane.leafId}`}
              />,
              pane.container,
              `orb-operation-${pane.id}`
            )
          : null
      })}
    </>
  )
}
