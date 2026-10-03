import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { hasRegisteredRuntimeTerminalTab } from '@/runtime/sync-runtime-graph'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/background-terminal-worktree-mount'
import { resolveAgentHubPtyId } from './agent-hub-pane-target'

/**
 * The pane's live PTY, attaching its tab in the background when needed. Why: after a
 * restart a tab stays detached until its pane mounts, so a pane the user has not visited
 * has no PTY to mirror or answer. Mobile wakes tabs the same way, without switching views.
 */
export function useAgentHubLivePty(
  worktreeId: string,
  tabId: string,
  paneKey: string | null
): string | null {
  const ptyId = useAppStore((s) => resolveAgentHubPtyId(s, tabId, paneKey))
  useEffect(() => {
    if (ptyId === null && !hasRegisteredRuntimeTerminalTab(tabId, worktreeId)) {
      requestBackgroundTerminalWorktreeMount({ worktreeId, tabIds: [tabId] })
    }
  }, [ptyId, tabId, worktreeId])
  return ptyId
}
