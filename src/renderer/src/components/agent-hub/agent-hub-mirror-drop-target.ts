import { tabInsertionSide } from '../tab-group/tab-insertion-geometry'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorSourceKey } from './agent-hub-mirror-membership'
import { agentHubPaneTargetKey } from './agent-hub-pane-target'
import type { AgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'

export type MirrorStripDrop = {
  kind: 'strip'
  windowId: string
  entryId: string | null
  side: 'left' | 'right'
}

export function currentMirrorDragEntry(drag: AgentHubMirrorTabDrag) {
  const source = readAgentHubMirrors().windows.find((window) => window.id === drag.windowId)
  const entry = source?.tabs.find((tab) => tab.id === drag.entryId)
  return entry &&
    agentHubMirrorSourceKey(entry.target) === drag.sourceKey &&
    agentHubPaneTargetKey(entry.target) === drag.target
    ? entry
    : null
}

export function mirrorStripDropAtPoint(point: { x: number; y: number }): MirrorStripDrop | null {
  const element = document.elementFromPoint(point.x, point.y)
  if (
    !element ||
    element.closest('[data-agent-hub-mirrors][data-hidden="true"], [data-agent-hub-no-tab-drop]')
  ) {
    return null
  }
  const strip = element.closest<HTMLElement>('[data-agent-hub-tab-strip]')
  const list = element.closest('[role="tablist"]')
  const windowId = strip?.dataset.agentHubTabStrip
  if (
    !strip ||
    !list ||
    !windowId ||
    !readAgentHubMirrors().windows.some((window) => window.id === windowId)
  ) {
    return null
  }
  const entry = element.closest<HTMLElement>('[data-agent-hub-tab-entry]')
  return {
    kind: 'strip',
    windowId,
    entryId: entry?.dataset.agentHubTabEntry ?? null,
    side: entry ? tabInsertionSide(point.x, entry.getBoundingClientRect()) : 'right'
  }
}

export function mirrorStripInsertionIndex(drop: MirrorStripDrop): number | null {
  const window = readAgentHubMirrors().windows.find((item) => item.id === drop.windowId)
  if (!window) {
    return null
  }
  if (!drop.entryId) {
    return window.tabs.length
  }
  const index = window.tabs.findIndex((tab) => tab.id === drop.entryId)
  return index === -1 ? null : index + (drop.side === 'right' ? 1 : 0)
}
