import { useAppStore } from '@/store'
import { requestWorkspaceSidebarReveal } from '@/lib/workspace/navigation/scroll-to-current-workspace-status'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/components/floating-terminal/workspace/floating-workspace-open-intent'
import { selectFloatingWorkspacePanelVisible } from '@/store/workspaces/floating/floating-workspace-panel-selector'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { minimizeAllAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** The floating workspace has no sidebar row to show. */
export function canRevealAgentHubTargetInSidebar(target: AgentHubPaneTarget): boolean {
  return target.worktree.id !== FLOATING_TERMINAL_WORKTREE_ID
}

/** Opens the sidebar on the target's workspace and parks every mirror out of the way. */
export function revealAgentHubTargetInSidebar(target: AgentHubPaneTarget): void {
  const state = useAppStore.getState()
  if (!state.sidebarOpen) {
    state.setSidebarOpen(true)
  }
  minimizeAllAgentHubMirrors()
  if (selectFloatingWorkspacePanelVisible(state)) {
    window.dispatchEvent(new Event(TOGGLE_FLOATING_TERMINAL_EVENT))
  }
  // The newly opened sidebar must subscribe before it receives the reveal request.
  requestAnimationFrame(() =>
    requestWorkspaceSidebarReveal(target.worktree.id, target.worktree.hostId)
  )
}
