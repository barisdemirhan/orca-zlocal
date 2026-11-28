import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import {
  agentHubTargetShowsThread,
  agentHubPaneTargetKey,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'

export const AGENT_HUB_MIRROR_TAB_CAP = 10
export const AGENT_HUB_MIRROR_ENTRY_CAP = 256
export type AgentHubMirrorTab = {
  id: string
  target: AgentHubPaneTarget
  viewing?: AgentHubPaneTarget
  origin: 'manual' | 'auto'
  isPinned?: boolean
}
export type AgentHubMirrorWindowState = {
  id: string
  tabs: readonly AgentHubMirrorTab[]
  activeTabId: string
}
export type AgentHubMirrorChip = {
  window: AgentHubMirrorWindowState
  minimizedAt: number
}
export type AgentHubMirrorState = {
  windows: readonly AgentHubMirrorWindowState[]
  chips: readonly AgentHubMirrorChip[]
}
export type AgentHubMirrorMembership = {
  window: AgentHubMirrorWindowState
  tab: AgentHubMirrorTab
  presence: 'window' | 'chip'
  kind: 'tab' | 'viewing'
}

export function shownAgentHubMirrorTarget(tab: AgentHubMirrorTab): AgentHubPaneTarget {
  return tab.viewing ?? tab.target
}

export function agentHubMirrorTabContainsThread(
  tab: AgentHubMirrorTab,
  thread: AgentPaneThread
): boolean {
  return (
    agentHubTargetShowsThread(tab.target, thread) ||
    agentHubTargetShowsThread(shownAgentHubMirrorTarget(tab), thread)
  )
}

export function homeAgentHubMirrorTab(tab: AgentHubMirrorTab): AgentHubMirrorTab {
  const { viewing: _viewing, ...home } = tab
  return home
}

export function agentHubMirrorSourceKey(target: AgentHubPaneTarget): string {
  return JSON.stringify([getWorktreeHostIdentity(target.worktree), target.tab.id])
}

export function agentHubMirrorWindows(state: AgentHubMirrorState): AgentHubMirrorWindowState[] {
  return [...state.windows, ...state.chips.map((chip) => chip.window)]
}

export function activeAgentHubMirrorTab(window: AgentHubMirrorWindowState): AgentHubMirrorTab {
  const tab = window.tabs.find((entry) => entry.id === window.activeTabId) ?? window.tabs[0]
  if (!tab) {
    throw new Error('A mirror window must contain a terminal')
  }
  return tab
}

export function agentHubMirrorWindowShowsThread(
  window: AgentHubMirrorWindowState,
  thread: AgentPaneThread
): boolean {
  return agentHubTargetShowsThread(
    shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window)),
    thread
  )
}

export function findAgentHubMirrorMembership(
  state: AgentHubMirrorState,
  target: AgentHubPaneTarget | string
): AgentHubMirrorMembership | null {
  const matches = (entry: AgentHubPaneTarget): boolean =>
    typeof target === 'string'
      ? agentHubPaneTargetKey(entry) === target
      : agentHubMirrorSourceKey(entry) === agentHubMirrorSourceKey(target)
  for (const kind of ['tab', 'viewing'] as const) {
    for (const window of agentHubMirrorWindows(state)) {
      const tab = window.tabs.find((entry) =>
        kind === 'tab'
          ? entry.id === target || matches(entry.target)
          : Boolean(entry.viewing && matches(entry.viewing))
      )
      if (tab) {
        return { window, tab, kind, presence: state.windows.includes(window) ? 'window' : 'chip' }
      }
    }
  }
  return null
}

export function createAgentHubMirrorWindow(target: AgentHubPaneTarget): AgentHubMirrorWindowState {
  const tab = { id: createBrowserUuid(), target, origin: 'manual' as const }
  return { id: createBrowserUuid(), tabs: [tab], activeTabId: tab.id }
}

export function selectAgentHubMirrorTarget(
  window: AgentHubMirrorWindowState,
  tabId: string,
  target?: AgentHubPaneTarget
): AgentHubMirrorWindowState {
  return {
    ...window,
    activeTabId: tabId,
    tabs: window.tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...(target ? homeAgentHubMirrorTab(tab) : tab),
            target: target ?? tab.target,
            origin: 'manual'
          }
        : tab
    )
  }
}

/** Replacing or removing a window is atomic across the open and parked lists. */
export function replaceAgentHubMirrorWindow(
  state: AgentHubMirrorState,
  id: string,
  next: AgentHubMirrorWindowState | null
): AgentHubMirrorState {
  return {
    windows: state.windows.flatMap((window) => (window.id === id ? (next ?? []) : window)),
    chips: state.chips.flatMap((chip) =>
      chip.window.id === id ? (next ? { ...chip, window: next } : []) : chip
    )
  }
}

export function removeAgentHubMirrorTab(
  window: AgentHubMirrorWindowState,
  tabId: string
): AgentHubMirrorWindowState | null {
  const index = window.tabs.findIndex((tab) => tab.id === tabId)
  const tabs = window.tabs.filter((tab) => tab.id !== tabId)
  const active = tabs[Math.min(Math.max(0, index), tabs.length - 1)]
  return active
    ? {
        ...window,
        tabs,
        activeTabId: window.activeTabId === tabId ? active.id : window.activeTabId
      }
    : null
}

export function hasAgentHubMirrorEntryRoom(current: AgentHubMirrorState): boolean {
  return (
    agentHubMirrorWindows(current).reduce((count, window) => count + window.tabs.length, 0) <
    AGENT_HUB_MIRROR_ENTRY_CAP
  )
}

export function clearAgentHubMirrorViewing(
  state: AgentHubMirrorState,
  isGone: (target: AgentHubPaneTarget) => boolean
): AgentHubMirrorState {
  let next = state
  for (const window of agentHubMirrorWindows(state)) {
    const tabs = window.tabs.map((tab) =>
      tab.viewing && isGone(tab.viewing) ? homeAgentHubMirrorTab(tab) : tab
    )
    if (tabs.some((tab, index) => tab !== window.tabs[index])) {
      next = replaceAgentHubMirrorWindow(next, window.id, { ...window, tabs })
    }
  }
  return next
}

/** Drops entries whose source is gone, from open windows and chips alike. */
export function removeAgentHubMirrorEntries(
  state: AgentHubMirrorState,
  isGone: (target: AgentHubPaneTarget) => boolean
): AgentHubMirrorState {
  let next = clearAgentHubMirrorViewing(state, isGone)
  for (const window of agentHubMirrorWindows(state)) {
    for (const tab of window.tabs.filter((entry) => isGone(entry.target))) {
      const current = agentHubMirrorWindows(next).find((item) => item.id === window.id)
      if (current) {
        next = replaceAgentHubMirrorWindow(
          next,
          current.id,
          removeAgentHubMirrorTab(current, tab.id)
        )
      }
    }
  }
  return next
}

export function orderAgentHubMirrorTabs(tabs: readonly AgentHubMirrorTab[]): AgentHubMirrorTab[] {
  return [...tabs.filter((tab) => tab.isPinned), ...tabs.filter((tab) => !tab.isPinned)]
}
