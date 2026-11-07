import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { partitionPinnedTabOrder } from '../../../../shared/workspace-layout/tab-order'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  clearAgentHubMirrorViewing,
  orderAgentHubMirrorTabs,
  agentHubMirrorWindows,
  agentHubMirrorSourceKey,
  findAgentHubMirrorMembership,
  replaceAgentHubMirrorWindow,
  removeAgentHubMirrorTab,
  selectAgentHubMirrorTarget,
  AGENT_HUB_MIRROR_TAB_CAP,
  AGENT_HUB_MIRROR_ENTRY_CAP,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { commitAgentHubMirrorState, readAgentHubMirrors } from './agent-hub-mirror-store'
import { resolveAgentHubMirrorTarget } from './agent-hub-mirror-source'

export type AgentHubMirrorTabResult =
  | { status: 'changed'; windowId: string; tabId: string }
  | {
      status:
        | 'noop'
        | 'missing-window'
        | 'missing-entry'
        | 'missing-source'
        | 'already-owned'
        | 'tab-cap'
        | 'entry-cap'
        | 'invalid-order'
    }

const findWindow = (id: string): AgentHubMirrorWindowState | undefined =>
  agentHubMirrorWindows(readAgentHubMirrors()).find((window) => window.id === id)
const changed = (window: AgentHubMirrorWindowState, tabId: string): AgentHubMirrorTabResult => ({
  status: 'changed',
  windowId: window.id,
  tabId
})

export function addAgentHubMirrorTab(
  windowId: string,
  request: AgentHubPaneTarget,
  focusTerminal = true
): AgentHubMirrorTabResult {
  const target = resolveAgentHubMirrorTarget(request)
  if (!target) {
    return { status: 'missing-source' }
  }
  const state = readAgentHubMirrors()
  const window = findWindow(windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  if (findAgentHubMirrorMembership(state, target)?.kind === 'tab') {
    return { status: 'already-owned' }
  }
  if (window.tabs.length >= AGENT_HUB_MIRROR_TAB_CAP) {
    return { status: 'tab-cap' }
  }
  if (
    agentHubMirrorWindows(state).reduce((count, item) => count + item.tabs.length, 0) >=
    AGENT_HUB_MIRROR_ENTRY_CAP
  ) {
    return { status: 'entry-cap' }
  }
  const tab = { id: createBrowserUuid(), target, origin: 'manual' as const }
  const released = clearAgentHubMirrorViewing(
    state,
    (entry) => agentHubMirrorSourceKey(entry) === agentHubMirrorSourceKey(target)
  )
  const homeWindow =
    agentHubMirrorWindows(released).find((entry) => entry.id === window.id) ?? window
  const next = {
    ...homeWindow,
    tabs: [...homeWindow.tabs.map((item) => ({ ...item, origin: 'manual' as const })), tab],
    activeTabId: tab.id
  }
  commitAgentHubMirrorState(replaceAgentHubMirrorWindow(released, window.id, next), window.id)
  requestAgentHubMirrorSelection(next.id, tab.id, focusTerminal)
  return changed(next, tab.id)
}
export function activateAgentHubMirrorTab(
  windowId: string,
  tabId: string,
  focusTerminal = true
): AgentHubMirrorTabResult {
  const window = findWindow(windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  const tab = window.tabs.find((entry) => entry.id === tabId)
  if (!tab) {
    return { status: 'missing-entry' }
  }
  const target = resolveAgentHubMirrorTarget(tab.target)
  if (!target) {
    return { status: 'missing-source' }
  }
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(
      readAgentHubMirrors(),
      windowId,
      selectAgentHubMirrorTarget(
        {
          ...window,
          tabs: window.tabs.map((entry) => (entry.id === tabId ? { ...entry, target } : entry))
        },
        tabId
      )
    ),
    windowId
  )
  requestAgentHubMirrorSelection(windowId, tabId, focusTerminal)
  return changed(window, tabId)
}
export function reorderAgentHubMirrorTabs(
  windowId: string,
  order: readonly string[]
): AgentHubMirrorTabResult {
  const window = findWindow(windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  if (
    order.length !== window.tabs.length ||
    new Set(order).size !== order.length ||
    order.some((id) => !window.tabs.some((tab) => tab.id === id))
  ) {
    return { status: 'invalid-order' }
  }
  // Why no source check: reordering moves nothing out of the window, so a disconnected entry can stay.
  const tabs = orderAgentHubMirrorTabs(
    order.flatMap((id) => window.tabs.find((tab) => tab.id === id) ?? [])
  )
  if (tabs.every((tab, index) => tab === window.tabs[index])) {
    return { status: 'noop' }
  }
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(readAgentHubMirrors(), windowId, { ...window, tabs })
  )
  return changed(window, window.activeTabId)
}
export function closeAgentHubMirrorTab(windowId: string, tabId: string): AgentHubMirrorTabResult {
  if (findWindow(windowId)?.tabs.find((tab) => tab.id === tabId)?.isPinned) {
    return { status: 'noop' }
  }
  return returnAgentHubMirrorTabToWorkspace(windowId, tabId)
}

/** Explicit navigation releases mirror ownership, including a pinned entry. */
export function returnAgentHubMirrorTabToWorkspace(
  windowId: string,
  tabId: string
): AgentHubMirrorTabResult {
  const window = findWindow(windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  const tab = window.tabs.find((entry) => entry.id === tabId)
  if (!tab) {
    return { status: 'missing-entry' }
  }
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(
      readAgentHubMirrors(),
      windowId,
      removeAgentHubMirrorTab(window, tabId)
    )
  )
  return changed(window, tabId)
}
export { moveAgentHubMirrorTab, detachAgentHubMirrorTab } from './agent-hub-mirror-tab-transfer'

export function toggleAgentHubMirrorTabPin(
  windowId: string,
  tabId: string
): AgentHubMirrorTabResult {
  const window = findWindow(windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  if (!window.tabs.some((tab) => tab.id === tabId)) {
    return { status: 'missing-entry' }
  }
  const tabs = window.tabs.map((tab) =>
    tab.id === tabId ? { ...tab, isPinned: !tab.isPinned, origin: 'manual' as const } : tab
  )
  const order = partitionPinnedTabOrder(
    tabs.map((tab) => tab.id),
    tabs,
    tabId
  )
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(readAgentHubMirrors(), windowId, {
      ...window,
      tabs: order.flatMap((id) => tabs.find((tab) => tab.id === id) ?? [])
    })
  )
  return changed(window, tabId)
}
