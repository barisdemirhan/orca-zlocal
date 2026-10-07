import { tabInsertionIndexAfterRemoval } from '../tab-group/tab-insertion-geometry'
import { isAgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'
import {
  currentMirrorDragEntry,
  mirrorStripInsertionIndex,
  type MirrorStripDrop
} from './agent-hub-mirror-drop-target'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import {
  reorderAgentHubMirrorTabs,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

export function commitMirrorTabDrop(
  payload: unknown,
  drop: MirrorStripDrop | null
): AgentHubMirrorTabResult {
  if (
    !isAgentHubMirrorTabDrag(payload) ||
    !drop ||
    !currentMirrorDragEntry(payload) ||
    drop.windowId !== payload.windowId
  ) {
    return { status: 'noop' }
  }
  const source = readAgentHubMirrors().windows.find((window) => window.id === payload.windowId)
  const insertion = mirrorStripInsertionIndex(drop)
  if (!source || insertion === null) {
    return { status: 'noop' }
  }
  const sourceIndex = source.tabs.findIndex((entry) => entry.id === payload.entryId)
  const index = tabInsertionIndexAfterRemoval(insertion, sourceIndex)
  const order = source.tabs.map((entry) => entry.id)
  order.splice(sourceIndex, 1)
  order.splice(index, 0, payload.entryId)
  return reorderAgentHubMirrorTabs(source.id, order)
}
