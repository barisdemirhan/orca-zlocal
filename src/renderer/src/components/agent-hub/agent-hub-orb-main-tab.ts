import { useAppStore } from '@/store'

/** `shownTabId` while the chosen chat is open in a main tab: no pane takes the Orb's place until Bring here. */
export const ORB_CHAT_IN_MAIN_TAB = ''

/** The chat's tab is the one a main window shows right now. */
export function orbTabShownInMain(tabId: string): boolean {
  const state = useAppStore.getState()
  if (state.activeView !== 'terminal' || !state.activeWorktreeId) {
    return false
  }
  const worktreeId = state.activeWorktreeId
  const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find((entry) => entry.id === tabId)
  return Boolean(
    tab &&
    (state.groupsByWorktree[worktreeId] ?? []).some(
      (group) => group.id === tab.groupId && group.activeTabId === tab.id
    )
  )
}

/** What `shownTabId` becomes when the strip shows this chat's tab. */
export function orbShownTabIdFor(tabId: string): string {
  return orbTabShownInMain(tabId) ? ORB_CHAT_IN_MAIN_TAB : tabId
}
