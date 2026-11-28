import { tabInsertionSide } from '../tab-group/tab-insertion-geometry'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubMirrorSourceKey, AGENT_HUB_MIRROR_TAB_CAP } from './agent-hub-mirror-membership'
import { agentHubPaneTargetKey } from './agent-hub-pane-target'
import type { AgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'

export type MirrorStripDrop = {
  kind: 'strip'
  windowId: string
  entryId: string | null
  side: 'left' | 'right'
}
export type MirrorTabDrop = MirrorStripDrop | { kind: 'detach'; point: { x: number; y: number } }

export function canAcceptMirrorTabDrop(
  drag: AgentHubMirrorTabDrag | null,
  drop: MirrorTabDrop | null
): boolean {
  if (!drag || !drop || !currentMirrorDragEntry(drag)) {
    return false
  }
  if (drop.kind === 'detach' || drop.windowId === drag.windowId) {
    return true
  }
  const window = readAgentHubMirrors().windows.find((item) => item.id === drop.windowId)
  return !!window && window.tabs.length < AGENT_HUB_MIRROR_TAB_CAP
}

export function mirrorTabDropAtPoint(point: { x: number; y: number }): MirrorTabDrop | null {
  const strip = mirrorStripDropAtPoint(point)
  if (strip) {
    return strip
  }
  const element = document.elementFromPoint(point.x, point.y)
  if (
    !element ||
    element.closest(
      'button,input,textarea,select,[role="menu"],[data-agent-hub-mirror],[data-agent-hub-dock],[data-agent-hub-mirrors][data-hidden="true"]'
    )
  ) {
    return null
  }
  if (
    element.matches(
      '[data-agent-hub-new-mirror-drop], [data-agent-hub-canvas], [data-agent-hub-mirror-stage-background]'
    )
  ) {
    return { kind: 'detach', point }
  }
  return null
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
  if (!strip) {
    return mirrorHeaderAppendDrop(element)
  }
  const list = element.closest('[role="tablist"]')
  const windowId = strip.dataset.agentHubTabStrip
  if (
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

// Empty header chrome (outside the strip and controls) appends to that window's strip.
function mirrorHeaderAppendDrop(element: Element): MirrorStripDrop | null {
  const windowId = element.closest<HTMLElement>('[data-agent-hub-mirror-header]')?.dataset
    .agentHubMirrorHeader
  if (
    !windowId ||
    element.closest('button,input,textarea,select,[role="menu"]') ||
    !readAgentHubMirrors().windows.some((window) => window.id === windowId)
  ) {
    return null
  }
  return { kind: 'strip', windowId, entryId: null, side: 'right' }
}
