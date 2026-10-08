import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { pruneClosedAgentHubMirrorSources } from './agent-hub-mirror-store'

/** Takes a mirror entry away once its source tab or split leaf closes. */
export function usePruneClosedAgentHubMirrorSources(): void {
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
        state.terminalLayoutsByTabId !== previous.terminalLayoutsByTabId
      ) {
        pruneClosedAgentHubMirrorSources()
      }
    })
  }, [sessionReady])
}
