import type { Tab, TabGroup } from '../../../../shared/workspace-layout/tab-groups/tab-types'

export function isTerminalSourceVisible(
  state: {
    activeView: string
    activeWorktreeId: string | null
    activeTabId: string | null
    activeTabType: string
    unifiedTabsByWorktree: Record<
      string,
      readonly Pick<Tab, 'id' | 'entityId' | 'contentType' | 'groupId'>[]
    >
    groupsByWorktree: Record<string, readonly Pick<TabGroup, 'id' | 'activeTabId'>[]>
  },
  worktreeId: string,
  tabId: string,
  covered: boolean
): boolean {
  if (covered || state.activeView !== 'terminal' || state.activeWorktreeId !== worktreeId) {
    return false
  }
  const groups = state.groupsByWorktree[worktreeId] ?? []
  if (groups.length === 0) {
    return state.activeTabType === 'terminal' && state.activeTabId === tabId
  }
  return (state.unifiedTabsByWorktree[worktreeId] ?? []).some(
    (tab) =>
      ((tab.contentType === 'terminal' && tab.entityId === tabId) ||
        (tab.contentType === 'agent-session' && tab.id === tabId)) &&
      groups.some((group) => group.id === tab.groupId && group.activeTabId === tab.id)
  )
}
