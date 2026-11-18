import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { hasRegisteredRuntimeTerminalTab } from '@/runtime/hosted-terminals/mounted-surfaces/mounted-terminal-tab-registry'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/workspace-mounting/background-terminal-worktree-mount'
import { resolveAgentHubPtyId } from './agent-hub-pane-target'

/**
 * The pane's live PTY, attaching its tab in the background when needed. Why: after a
 * restart a tab stays detached until its pane mounts, so a pane the user has not visited
 * has no PTY to mirror or answer. Mobile wakes tabs the same way, without switching views.
 */
export function useAgentHubLivePty(
  worktreeId: string,
  tabId: string,
  paneKey: string | null,
  /** The window borrows the rendered pane itself, so its tab must be mounted even with a live PTY. */
  needsMountedPane: boolean
): string | null {
  const ptyId = useAppStore((s) => resolveAgentHubPtyId(s, tabId, paneKey))
  const detached = ptyId === null && !hasRegisteredRuntimeTerminalTab(tabId, worktreeId)
  useEffect(() => {
    // Why always safe: a mount request never narrows a worktree that is already mounted.
    if (needsMountedPane || detached) {
      requestBackgroundTerminalWorktreeMount({ worktreeId, tabIds: [tabId] })
    }
  }, [detached, needsMountedPane, tabId, worktreeId])
  return ptyId
}
