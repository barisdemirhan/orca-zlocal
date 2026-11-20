import { useAppStore } from '@/store'
import { destroyWorkspaceWebviews } from '@/store/slices/browser/cleanup/browser-webview-cleanup'
import { AGENT_HUB_PEEK_WORKTREE_ID } from '../../../../shared/agent-hub-peek-workspace'

export function closeAgentHubPeekBrowserTab(tabId: string): void {
  const state = useAppStore.getState()
  state.closeBrowserTab(tabId, { reason: 'cleanup' })
  destroyWorkspaceWebviews(state.browserPagesByWorkspace, tabId)
  if (!useAppStore.getState().browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]?.length) {
    useAppStore.getState().purgeWorktreeTerminalState([AGENT_HUB_PEEK_WORKTREE_ID])
  }
}

/** Retires private pages restored from a previous renderer session. */
export function closeLeftoverAgentHubPeekPages(): void {
  for (const tab of useAppStore.getState().browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID] ??
    []) {
    closeAgentHubPeekBrowserTab(tab.id)
  }
  useAppStore.getState().purgeWorktreeTerminalState([AGENT_HUB_PEEK_WORKTREE_ID])
}
