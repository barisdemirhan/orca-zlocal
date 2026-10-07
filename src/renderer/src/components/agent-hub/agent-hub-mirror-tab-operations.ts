import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { createBrowserUuid } from '@/lib/browser-uuid'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  activeAgentHubMirrorTab,
  agentHubMirrorWindows,
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
import {
  clampAgentHubMirrorGeometry,
  agentHubMirrorOpenGeometry
} from './agent-hub-mirror-geometry'
import { readAgentHubMirrorOrigin, rememberAgentHubMirrorOrigin } from './agent-hub-mirror-places'

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
  request: AgentHubPaneTarget
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
  if (findAgentHubMirrorMembership(state, target)) {
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
  const next = {
    ...window,
    tabs: [...window.tabs.map((item) => ({ ...item, origin: 'manual' as const })), tab],
    activeTabId: tab.id
  }
  commitAgentHubMirrorState(replaceAgentHubMirrorWindow(state, window.id, next), window.id)
  requestAgentHubMirrorSelection(next.id, tab.id)
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
      selectAgentHubMirrorTarget(window, tabId, target)
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
  const tabs = order.flatMap((id) => window.tabs.find((tab) => tab.id === id) ?? [])
  if (tabs.some((tab) => !resolveAgentHubMirrorTarget(tab.target))) {
    return { status: 'missing-source' }
  }
  if (tabs.every((tab, index) => tab === window.tabs[index])) {
    return { status: 'noop' }
  }
  commitAgentHubMirrorState(
    replaceAgentHubMirrorWindow(readAgentHubMirrors(), windowId, { ...window, tabs })
  )
  return changed(window, window.activeTabId)
}
export function closeAgentHubMirrorTab(windowId: string, tabId: string): AgentHubMirrorTabResult {
  const window = findWindow(windowId)
  if (!window) {
    return { status: 'missing-window' }
  }
  if (!window.tabs.some((tab) => tab.id === tabId)) {
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
export function moveAgentHubMirrorTab(
  fromId: string,
  tabId: string,
  toId: string,
  index: number
): AgentHubMirrorTabResult {
  const source = findWindow(fromId)
  const destination = findWindow(toId)
  if (!source || !destination) {
    return { status: 'missing-window' }
  }
  const tab = source.tabs.find((entry) => entry.id === tabId)
  if (!tab) {
    return { status: 'missing-entry' }
  }
  const target = resolveAgentHubMirrorTarget(tab.target)
  if (!target) {
    return { status: 'missing-source' }
  }
  if (!Number.isFinite(index)) {
    return { status: 'invalid-order' }
  }
  if (fromId !== toId && destination.tabs.length >= AGENT_HUB_MIRROR_TAB_CAP) {
    return { status: 'tab-cap' }
  }
  const tabs = destination.tabs
    .filter((entry) => entry.id !== tabId)
    .map((entry) => ({ ...entry, origin: 'manual' as const }))
  tabs.splice(Math.max(0, Math.min(tabs.length, Math.trunc(index))), 0, {
    ...tab,
    target,
    origin: 'manual'
  })
  const next = { ...destination, tabs, activeTabId: tabId }
  let state = readAgentHubMirrors()
  if (fromId !== toId) {
    state = replaceAgentHubMirrorWindow(state, fromId, removeAgentHubMirrorTab(source, tabId))
  }
  commitAgentHubMirrorState(replaceAgentHubMirrorWindow(state, toId, next), toId)
  return changed(next, tabId)
}
export function detachAgentHubMirrorTab(
  windowId: string,
  tabId: string,
  point: { x: number; y: number }
): AgentHubMirrorTabResult {
  const source = findWindow(windowId)
  if (!source) {
    return { status: 'missing-window' }
  }
  const tab = source.tabs.find((entry) => entry.id === tabId)
  if (!tab) {
    return { status: 'missing-entry' }
  }
  const target = resolveAgentHubMirrorTarget(tab.target)
  if (!target) {
    return { status: 'missing-source' }
  }
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { status: 'invalid-order' }
  }
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const original =
    readAgentHubMirrorOrigin(source.id) ??
    agentHubMirrorOpenGeometry({ width: 640, height: 400 }, { left: 0, top: 0, ...viewport }, [])
  const geometry = clampAgentHubMirrorGeometry({ ...original, ...point }, viewport)
  const single = source.tabs.length === 1
  const next = {
    id: single ? source.id : createBrowserUuid(),
    tabs: [{ ...tab, target, origin: 'manual' as const }],
    activeTabId: tab.id
  }
  const state = replaceAgentHubMirrorWindow(
    readAgentHubMirrors(),
    source.id,
    single ? null : removeAgentHubMirrorTab(source, tabId)
  )
  // Geometry belongs to the window; a last-entry detach reuses its original identity and size.
  rememberAgentHubMirrorOrigin(next.id, geometry)
  commitAgentHubMirrorState({ ...state, windows: [...state.windows, next] })
  return changed(next, activeAgentHubMirrorTab(next).id)
}
