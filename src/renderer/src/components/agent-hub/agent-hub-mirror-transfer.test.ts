/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  subscribeAgentHubMirrors,
  minimizeAgentHubMirror,
  setAgentHubMirrorWindowCap
} from './agent-hub-mirror-store'
import {
  addAgentHubMirrorTab,
  moveAgentHubMirrorTab,
  detachAgentHubMirrorTab
} from './agent-hub-mirror-tab-operations'
import { mirrorTabDragData } from './agent-hub-mirror-drag-data'
import { commitMirrorTabDrop } from './agent-hub-mirror-drag-commit'
import { mirrorTabDropAtPoint, canAcceptMirrorTabDrop } from './agent-hub-mirror-drop-target'
import { readAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'

vi.mock('./agent-hub-mirror-source', () => ({
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  resetAgentHubMirrorsForTest()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
function open(title: string) {
  const worktree = makeWorktree()
  const target: AgentHubPaneTarget = {
    worktree,
    repo: null,
    tab: makeTabWithIds(title, worktree.id),
    paneKey: null,
    title,
    agentType: null
  }
  openAgentHubMirror(target)
  return readAgentHubMirrors().windows.at(-1)!
}
it('moves once atomically, activates/raises the destination, closes an emptied source and preserves home ownership', () => {
  const source = open('a'),
    destination = open('b')
  const payload = mirrorTabDragData(source.id, source.tabs[0]!)
  const originalTarget = source.tabs[0]!.target
  const snapshots: unknown[] = []
  const stop = subscribeAgentHubMirrors(() => snapshots.push(readAgentHubMirrors()))
  const drop = {
    kind: 'strip' as const,
    windowId: destination.id,
    entryId: destination.tabs[0]!.id,
    side: 'left' as const
  }
  expect(commitMirrorTabDrop(payload, drop).status).toBe('changed')
  expect(snapshots).toHaveLength(1)
  const moved = readAgentHubMirrors().windows.at(-1)!
  expect(moved.id).toBe(destination.id)
  expect(moved.tabs[0]?.target).toBe(originalTarget)
  expect(moved.activeTabId).toBe(payload.entryId)
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  expect(commitMirrorTabDrop(payload, drop).status).toBe('noop')
  expect(snapshots).toHaveLength(1)
  stop()
})
it('refuses ten-tab destinations and parked sources/destinations without any partial state or resurrection', () => {
  const source = open('a'),
    destination = open('b')
  for (let i = 0; i < 9; i++) {
    addAgentHubMirrorTab(destination.id, {
      ...destination.tabs[0]!.target,
      tab: makeTabWithIds(`extra-${i}`, destination.tabs[0]!.target.worktree.id)
    })
  }
  const payload = mirrorTabDragData(source.id, source.tabs[0]!)
  const drop = {
    kind: 'strip' as const,
    windowId: destination.id,
    entryId: null,
    side: 'right' as const
  }
  const before = readAgentHubMirrors()
  expect(canAcceptMirrorTabDrop(payload, drop)).toBe(false)
  expect(commitMirrorTabDrop(payload, drop).status).toBe('tab-cap')
  expect(readAgentHubMirrors()).toBe(before)
  minimizeAgentHubMirror(destination.id)
  expect(moveAgentHubMirrorTab(source.id, payload.entryId, destination.id, 0).status).toBe(
    'missing-window'
  )
  minimizeAgentHubMirror(source.id)
  expect(detachAgentHubMirrorTab(source.id, payload.entryId, { x: 1, y: 1 }).status).toBe(
    'missing-window'
  )
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})
it('detaches a group into a clamped new window, parks the complete back-most window at cap, and moves a singleton in place', () => {
  setAgentHubMirrorWindowCap(2)
  const back = open('back'),
    source = open('a')
  addAgentHubMirrorTab(back.id, {
    ...back.tabs[0]!.target,
    tab: makeTabWithIds('back-extra', back.tabs[0]!.target.worktree.id)
  })
  addAgentHubMirrorTab(source.id, {
    ...source.tabs[0]!.target,
    tab: makeTabWithIds('extra', source.tabs[0]!.target.worktree.id)
  })
  const result = detachAgentHubMirrorTab(source.id, source.tabs[0]!.id, { x: 100000, y: 100000 })
  expect(result.status).toBe('changed')
  const detached = readAgentHubMirrors().windows.at(-1)!
  expect(detached.id).not.toBe(source.id)
  expect(detached.tabs[0]?.id).toBe(source.tabs[0]!.id)
  expect(readAgentHubMirrors().chips[0]?.window.id).toBe(back.id)
  expect(readAgentHubMirrors().chips[0]?.window.tabs).toHaveLength(2)
  const geometry = readAgentHubMirrorOrigin(detached.id)!
  const area = agentHubWorkArea()
  expect(geometry.x + geometry.width).toBeLessThanOrEqual(area.left + area.width)
  expect(geometry.y + geometry.height).toBeLessThanOrEqual(area.top + area.height)
  detachAgentHubMirrorTab(detached.id, detached.tabs[0]!.id, { x: -9999, y: -9999 })
  expect(readAgentHubMirrors().windows.at(-1)?.id).toBe(detached.id)
  expect(readAgentHubMirrors().windows).toHaveLength(2)
  expect(readAgentHubMirrorOrigin(detached.id)).toMatchObject({
    x: area.left,
    y: area.top,
    width: geometry.width,
    height: geometry.height
  })
})
it('only detaches on exposed designated backgrounds; child controls and covered backgrounds stay forbidden', () => {
  document.body.innerHTML =
    '<div data-agent-hub-canvas><button id="control"></button></div><div data-agent-hub-new-mirror-drop></div><div data-agent-hub-mirror-stage-background></div><section data-agent-hub-mirror><div id="body"></div></section><div data-tab-id="normal"></div><aside></aside><div data-floating-terminal-panel></div><div data-agent-hub-dock></div><div role="menu"></div>'
  const hit = vi.spyOn(document, 'elementFromPoint')
  for (const selector of [
    '[data-agent-hub-canvas]',
    '[data-agent-hub-new-mirror-drop]',
    '[data-agent-hub-mirror-stage-background]'
  ]) {
    hit.mockReturnValue(document.querySelector(selector))
    expect(mirrorTabDropAtPoint({ x: 20, y: 40 })).toEqual({
      kind: 'detach',
      point: { x: 20, y: 40 }
    })
  }
  for (const selector of [
    '#control',
    '#body',
    '[data-tab-id]',
    'aside',
    '[data-floating-terminal-panel]',
    '[data-agent-hub-dock]',
    '[role="menu"]'
  ]) {
    hit.mockReturnValue(document.querySelector(selector))
    expect(mirrorTabDropAtPoint({ x: 20, y: 40 })).toBeNull()
  }
})
