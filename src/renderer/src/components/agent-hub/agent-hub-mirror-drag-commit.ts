import { tabInsertionIndexAfterRemoval } from '../tab-group/tab-insertion-geometry'
import { isAgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'
import {
  currentMirrorDragEntry,
  mirrorStripInsertionIndex,
  type MirrorTabDrop
} from './agent-hub-mirror-drop-target'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import {
  reorderAgentHubMirrorTabs,
  moveAgentHubMirrorTab,
  detachAgentHubMirrorTab,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

export function commitMirrorTabDrop(
  payload: unknown,
  drop: MirrorTabDrop | null
): AgentHubMirrorTabResult {
  if (!isAgentHubMirrorTabDrag(payload) || !drop || !currentMirrorDragEntry(payload)) {
    return { status: 'noop' }
  }
  const source = readAgentHubMirrors().windows.find((window) => window.id === payload.windowId)
  if (drop.kind === 'detach') {
    return detachAgentHubMirrorTab(payload.windowId, payload.entryId, drop.point)
  }
  const insertion = mirrorStripInsertionIndex(drop)
  if (!source || insertion === null) {
    return { status: 'noop' }
  }
  if (drop.windowId !== payload.windowId) {
    return moveAgentHubMirrorTab(payload.windowId, payload.entryId, drop.windowId, insertion)
  }
  const sourceIndex = source.tabs.findIndex((entry) => entry.id === payload.entryId)
  const index = tabInsertionIndexAfterRemoval(insertion, sourceIndex)
  const order = source.tabs.map((entry) => entry.id)
  order.splice(sourceIndex, 1)
  order.splice(index, 0, payload.entryId)
  return reorderAgentHubMirrorTabs(source.id, order)
}
