import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import { requestAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import {
  AGENT_HUB_MIRROR_TAB_CAP,
  orderAgentHubMirrorTabs,
  replaceAgentHubMirrorWindow,
  removeAgentHubMirrorTab,
  activeAgentHubMirrorTab,
  homeAgentHubMirrorTab,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import { commitAgentHubMirrorState, readAgentHubMirrors } from './agent-hub-mirror-store'
import { resolveAgentHubMirrorTarget } from './agent-hub-mirror-source'
import { mirrorTabDetachGeometry } from './agent-hub-mirror-detach-geometry'
import { rememberAgentHubMirrorOrigin, keepAgentHubMirrorPlace } from './agent-hub-mirror-places'
import { requestAgentHubMirrorPlacement } from './agent-hub-floating-arrangement'
import { endAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import {
  reorderAgentHubMirrorTabs,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

const findWindow = (id: string): AgentHubMirrorWindowState | undefined =>
  readAgentHubMirrors().windows.find((window) => window.id === id)
const changed = (window: AgentHubMirrorWindowState, tabId: string): AgentHubMirrorTabResult => ({
  status: 'changed',
  windowId: window.id,
  tabId
})

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
  if (fromId === toId) {
    const order = source.tabs.filter((entry) => entry.id !== tabId).map((entry) => entry.id)
    order.splice(Math.max(0, Math.min(order.length, Math.trunc(index))), 0, tabId)
    return reorderAgentHubMirrorTabs(fromId, order)
  }
  const tabs = destination.tabs
    .filter((entry) => entry.id !== tabId)
    .map((entry) => ({ ...entry, origin: 'manual' as const }))
  tabs.splice(Math.max(0, Math.min(tabs.length, Math.trunc(index))), 0, {
    ...homeAgentHubMirrorTab(tab),
    target,
    origin: 'manual'
  })
  const next = { ...destination, tabs: orderAgentHubMirrorTabs(tabs), activeTabId: tabId }
  let state = readAgentHubMirrors()
  if (fromId !== toId) {
    state = replaceAgentHubMirrorWindow(state, fromId, removeAgentHubMirrorTab(source, tabId))
  }
  commitAgentHubMirrorState(replaceAgentHubMirrorWindow(state, toId, next), toId)
  requestAgentHubMirrorSelection(next.id, tabId)
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
  const geometry = mirrorTabDetachGeometry(source.id, point)
  const single = source.tabs.length === 1
  const next = {
    id: single ? source.id : createBrowserUuid(),
    tabs: [{ ...homeAgentHubMirrorTab(tab), target, origin: 'manual' as const }],
    activeTabId: tab.id
  }
  const state = replaceAgentHubMirrorWindow(
    readAgentHubMirrors(),
    source.id,
    single ? null : removeAgentHubMirrorTab(source, tabId)
  )
  // Geometry belongs to the window; a last-entry detach reuses its original identity and size.
  endAgentHubMirrorFocus()
  rememberAgentHubMirrorOrigin(next.id, geometry)
  keepAgentHubMirrorPlace(next.id)
  if (single) {
    requestAgentHubMirrorPlacement(next.id, geometry)
  }
  commitAgentHubMirrorState({ ...state, windows: [...state.windows, next] })
  requestAgentHubMirrorSelection(next.id, tab.id)
  return changed(next, activeAgentHubMirrorTab(next).id)
}
