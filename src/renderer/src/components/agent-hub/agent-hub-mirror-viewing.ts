import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import {
  agentHubMirrorWindows,
  agentHubMirrorSourceKey,
  findAgentHubMirrorMembership,
  homeAgentHubMirrorTab,
  shownAgentHubMirrorTarget,
  replaceAgentHubMirrorWindow
} from './agent-hub-mirror-membership'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { commitAgentHubMirrorState, readAgentHubMirrors } from './agent-hub-mirror-store'
import { resolveAgentHubMirrorTarget } from './agent-hub-mirror-source'
import {
  returnAgentHubMirrorTabToWorkspace,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

export function returnAgentHubMirrorTabHome(windowId: string, tabId: string): void {
  const state = readAgentHubMirrors()
  const window = agentHubMirrorWindows(state).find((entry) => entry.id === windowId)
  const tab = window?.tabs.find((entry) => entry.id === tabId)
  if (!window || !tab?.viewing) {
    return
  }
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(state, windowId, {
      ...window,
      tabs: window.tabs.map((entry) => (entry.id === tabId ? homeAgentHubMirrorTab(entry) : entry))
    }),
    windowId
  )
  requestAgentHubMirrorSelection(windowId, tabId)
}

export function toggleAgentHubMirrorViewing(
  windowId: string,
  tabId: string,
  request: AgentHubPaneTarget
): AgentHubMirrorTabResult {
  const state = readAgentHubMirrors()
  const window = agentHubMirrorWindows(state).find((entry) => entry.id === windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  const tab = window.tabs.find((entry) => entry.id === tabId)
  if (!tab) {
    return { status: 'missing-entry' }
  }
  const key = agentHubPaneTargetKey(request)
  const matches = (target: AgentHubPaneTarget): boolean =>
    key === agentHubPaneTargetKey(target) &&
    agentHubMirrorSourceKey(request) === agentHubMirrorSourceKey(target)
  if (matches(tab.target) || (tab.viewing && matches(tab.viewing))) {
    returnAgentHubMirrorTabHome(windowId, tabId)
    return { status: 'changed', windowId, tabId }
  }
  const target = resolveAgentHubMirrorTarget(request)
  if (!target) {
    return { status: 'missing-source' }
  }
  const owner = findAgentHubMirrorMembership(state, target)
  // A split leaf shares its home tab's PTY reservation.
  if (owner && owner.tab.id !== tabId) {
    return { status: 'already-owned' }
  }
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(state, windowId, {
      ...window,
      activeTabId: tabId,
      tabs: window.tabs.map((entry) => (entry.id === tabId ? { ...entry, viewing: target } : entry))
    }),
    windowId
  )
  requestAgentHubMirrorSelection(windowId, tabId)
  return { status: 'changed', windowId, tabId }
}

export function releaseAgentHubMirrorShownTarget(
  windowId: string,
  tabId: string
): AgentHubPaneTarget | null {
  const window = agentHubMirrorWindows(readAgentHubMirrors()).find((entry) => entry.id === windowId)
  const tab = window?.tabs.find((entry) => entry.id === tabId)
  if (!tab) {
    return null
  }
  const target = shownAgentHubMirrorTarget(tab)
  if (tab.isPinned) {
    return target
  }
  if (tab.viewing) {
    returnAgentHubMirrorTabHome(windowId, tabId)
  } else {
    returnAgentHubMirrorTabToWorkspace(windowId, tabId)
  }
  return target
}
