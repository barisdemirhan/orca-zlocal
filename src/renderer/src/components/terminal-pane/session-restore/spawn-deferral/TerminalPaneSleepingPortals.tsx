import { Suspense } from 'react'
import { AgentHubPaneSleepOverlay } from '../../../agent-hub/AgentHubPaneSleepOverlay'
import { useAgentHubPaneTarget } from '../../../agent-hub/agent-hub-pane-sleep'
import { createPortal } from 'react-dom'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import { usePaneSpawnDeferral } from '@/components/terminal-pane/session-restore/spawn-deferral/pane-spawn-deferral-registry'
import type { TerminalPaneController } from '../../controller/use-terminal-pane-controller'

const TerminalSleepingPaneOverlay = lazy(() =>
  import('./TerminalSleepingPaneOverlay').then((module) => ({
    default: module.TerminalSleepingPaneOverlay
  }))
)

function SleepingPanePortal({
  pane,
  tabId,
  worktreeId
}: {
  pane: ManagedPane
  tabId: string
  worktreeId: string
}): React.JSX.Element | null {
  const paneKey = makePaneKey(tabId, pane.leafId)
  const target = useAgentHubPaneTarget(worktreeId, tabId, paneKey)
  const deferral = usePaneSpawnDeferral(paneKey)
  if (target && (!deferral || deferral.manual)) {
    return createPortal(
      <AgentHubPaneSleepOverlay target={target} />,
      pane.container,
      `manual-sleeping-pane-${pane.id}`
    )
  }
  if (!deferral || deferral.manual || deferral.resuming) {
    return null
  }
  return createPortal(
    <Suspense fallback={null}>
      <TerminalSleepingPaneOverlay
        reason={deferral.reason}
        onResume={deferral.resume}
        onResumeAutomaticRestores={deferral.resumeAutomaticRestores}
      />
    </Suspense>,
    pane.container,
    `sleeping-pane-${pane.id}`
  )
}

export function TerminalPaneSleepingPortals({
  controller
}: {
  controller: TerminalPaneController
}): React.JSX.Element {
  const { managedPanes, tabId, worktreeId } = controller
  return (
    <>
      {managedPanes.map((pane) => (
        <SleepingPanePortal key={pane.id} pane={pane} tabId={tabId} worktreeId={worktreeId} />
      ))}
    </>
  )
}
