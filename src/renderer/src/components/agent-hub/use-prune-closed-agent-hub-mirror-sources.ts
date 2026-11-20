import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { clearAgentHubMirrorViewing } from './agent-hub-mirror-membership'
import { agentHubTargetShowsThread } from './agent-hub-pane-target'
import {
  commitAgentHubMirrorState,
  readAgentHubMirrors,
  pruneClosedAgentHubMirrorSources
} from './agent-hub-mirror-store'

/** Takes a mirror entry away once its source tab or split leaf closes. */
export function usePruneClosedAgentHubMirrorSources(threads?: readonly AgentPaneThread[]): void {
  useEffect(() => {
    if (!threads) {
      return
    }
    const state = readAgentHubMirrors()
    const next = clearAgentHubMirrorViewing(state, (target) =>
      Boolean(
        target.paneKey && !threads.some((thread) => agentHubTargetShowsThread(target, thread))
      )
    )
    if (next !== state) {
      commitAgentHubMirrorState(next)
    }
  }, [threads])
  // Why after hydration: before it, a tab missing from its workspace is not yet loaded, not closed.
  const sessionReady = useAppStore(
    (state) =>
      state.workspaceSessionReady &&
      state.hydrationSucceeded &&
      state.terminalStartupRestorationReady
  )
  useEffect(() => {
    if (!sessionReady) {
      return
    }
    pruneClosedAgentHubMirrorSources()
    return useAppStore.subscribe((state, previous) => {
      if (
        state.tabsByWorktree !== previous.tabsByWorktree ||
        state.unifiedTabsByWorktree !== previous.unifiedTabsByWorktree ||
        state.worktreesByRepo !== previous.worktreesByRepo ||
        state.folderWorkspaces !== previous.folderWorkspaces ||
        state.terminalLayoutsByTabId !== previous.terminalLayoutsByTabId
      ) {
        pruneClosedAgentHubMirrorSources()
      }
    })
  }, [sessionReady])
}
