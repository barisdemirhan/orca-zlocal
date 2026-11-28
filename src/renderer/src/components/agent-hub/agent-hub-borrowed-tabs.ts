import { shownAgentHubMirrorTarget, activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { readAgentHubMirrors, subscribeAgentHubMirrors } from './agent-hub-mirror-store'

type BorrowedTab = {
  worktreeId: string
  tabId: string
  unifiedTabId: string
  groupId: string
  mirrorKey: string
}
let borrowed: readonly BorrowedTab[] = []
const listeners = new Set<() => void>()
let stopWatching: (() => void) | null = null

function emit(next: readonly BorrowedTab[]): void {
  borrowed = next
  if (borrowed.length === 0) {
    stopWatching?.()
    stopWatching = null
  }
  listeners.forEach((listener) => listener())
}

export function borrowAgentHubTab(tab: BorrowedTab): void {
  if (!stopWatching) {
    const prune = (): void => {
      const state = useAppStore.getState()
      const windows = readAgentHubMirrors().windows
      const next = borrowed.filter(
        (item) =>
          state.settings?.experimentalAgentHub === true &&
          windows.some((window) => {
            const target = shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window))
            return (
              window.id === item.mirrorKey &&
              target.tab.id === item.tabId &&
              target.worktree.id === item.worktreeId
            )
          }) &&
          state.groupsByWorktree[item.worktreeId]?.some(
            (group) => group.id === item.groupId && group.activeTabId === item.unifiedTabId
          )
      )
      if (next.length !== borrowed.length) {
        emit(next)
      }
    }
    const stopStore = useAppStore.subscribe(prune)
    const stopMirrors = subscribeAgentHubMirrors(prune)
    stopWatching = () => {
      stopStore()
      stopMirrors()
    }
  }
  emit([...borrowed.filter((item) => item.tabId !== tab.tabId), tab])
}

export function readAgentHubBorrowedTab(tabId: string, worktreeId: string): BorrowedTab | null {
  return borrowed.find((tab) => tab.tabId === tabId && tab.worktreeId === worktreeId) ?? null
}

export function useAgentHubBorrowedTabs(): readonly BorrowedTab[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => borrowed,
    () => borrowed
  )
}
