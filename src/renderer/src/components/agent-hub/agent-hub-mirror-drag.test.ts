/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { isTabDragData } from '../tab-group/tab-drag-data'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  minimizeAgentHubMirror
} from './agent-hub-mirror-store'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { mirrorTabDragData, isAgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'
import { commitMirrorTabDrop } from './agent-hub-mirror-drag-commit'
import { mirrorStripDropAtPoint } from './agent-hub-mirror-drop-target'
import {
  isAgentHubMirrorWindowDragTarget,
  claimAgentHubMirrorGesture,
  releaseAgentHubMirrorGesture
} from './agent-hub-mirror-gesture'

vi.mock('./agent-hub-mirror-source', () => ({
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
function target(id: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(id, worktree.id),
    paneKey: null,
    title: id,
    agentType: null
  }
}
function fixture() {
  openAgentHubMirror(target('a'))
  const source = readAgentHubMirrors().windows[0]!
  addAgentHubMirrorTab(source.id, target('b'))
  addAgentHubMirrorTab(source.id, target('c'))
  const window = readAgentHubMirrors().windows[0]!
  return { window, payload: mirrorTabDragData(window.id, window.tabs[0]!) }
}
beforeEach(resetAgentHubMirrorsForTest)
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  releaseAgentHubMirrorGesture('window')
  releaseAgentHubMirrorGesture('tab')
})
it('reorders an anchored entry, preserves active selection, and publishes nothing for same-position drops', () => {
  const { window, payload } = fixture()
  const before = readAgentHubMirrors()
  expect(
    commitMirrorTabDrop(payload, {
      kind: 'strip',
      windowId: window.id,
      entryId: payload.entryId,
      side: 'right'
    }).status
  ).toBe('noop')
  expect(readAgentHubMirrors()).toBe(before)
  expect(
    commitMirrorTabDrop(payload, {
      kind: 'strip',
      windowId: window.id,
      entryId: window.tabs[1]!.id,
      side: 'left'
    }).status
  ).toBe('noop')
  expect(
    commitMirrorTabDrop(payload, {
      kind: 'strip',
      windowId: window.id,
      entryId: null,
      side: 'right'
    }).status
  ).toBe('changed')
  expect(readAgentHubMirrors().windows[0]?.tabs.map((tab) => tab.target.title)).toEqual([
    'b',
    'c',
    'a'
  ])
  expect(readAgentHubMirrors().windows[0]?.activeTabId).toBe(window.activeTabId)
})
it('rejects payload kinds both ways and refuses stale, parked or changed source identities', () => {
  const { window, payload } = fixture()
  expect(isTabDragData(payload)).toBe(false)
  expect(isAgentHubMirrorTabDrag({ kind: 'tab' })).toBe(false)
  const drop = {
    kind: 'strip' as const,
    windowId: window.id,
    entryId: null,
    side: 'right' as const
  }
  const before = readAgentHubMirrors()
  expect(commitMirrorTabDrop({ kind: 'tab' }, drop).status).toBe('noop')
  expect(commitMirrorTabDrop({ ...payload, target: 'stale' }, drop).status).toBe('noop')
  expect(commitMirrorTabDrop(payload, null).status).toBe('noop')
  expect(readAgentHubMirrors()).toBe(before)
  minimizeAgentHubMirror(window.id)
  expect(commitMirrorTabDrop(payload, drop).status).toBe('noop')
})
it('uses only the frontmost exposed strip and excludes buttons, terminal bodies and unrelated app surfaces', () => {
  const { window } = fixture()
  document.body.innerHTML = `<section data-agent-hub-mirror><div data-agent-hub-tab-strip="${window.id}"><div role="tablist"><div data-agent-hub-tab-entry="${window.tabs[1]!.id}"><button role="tab"><svg><path /></svg></button><button data-agent-hub-no-tab-drop><svg /></button></div><div id="trailing"></div></div><button id="plus"></button></div><div class="xterm"></div></section><div data-tab-id="normal"></div><div data-floating-terminal-panel></div><div data-agent-hub-dock></div><aside></aside><div role="menu"></div>`
  const hit = vi.spyOn(document, 'elementFromPoint')
  const svg = document.querySelector('[role="tab"] path')!
  hit.mockReturnValue(svg)
  expect(mirrorStripDropAtPoint({ x: 0, y: 0 })?.entryId).toBe(window.tabs[1]!.id)
  hit.mockReturnValue(document.querySelector('#trailing'))
  expect(mirrorStripDropAtPoint({ x: 0, y: 0 })?.entryId).toBeNull()
  for (const selector of [
    '[data-agent-hub-no-tab-drop] svg',
    '#plus',
    '.xterm',
    '[data-tab-id]',
    '[data-floating-terminal-panel]',
    '[data-agent-hub-dock]',
    'aside',
    '[role="menu"]'
  ]) {
    hit.mockReturnValue(document.querySelector(selector))
    expect(mirrorStripDropAtPoint({ x: 0, y: 0 })).toBeNull()
  }
  hit.mockReturnValue(null)
  expect(mirrorStripDropAtPoint({ x: -1, y: -1 })).toBeNull()
})
it('appends to a window when the pointer is over its empty header but not its controls', () => {
  const { window } = fixture()
  document.body.innerHTML = `<header data-agent-hub-mirror-header="${window.id}"><div data-agent-hub-tab-strip="${window.id}"><div role="tablist"></div></div><div id="grip"></div><div id="controls"><button id="close"><svg /></button><button id="jump" data-agent-hub-no-tab-drop></button></div></header><div id="outside"></div>`
  const hit = vi.spyOn(document, 'elementFromPoint')
  hit.mockReturnValue(document.querySelector('#grip'))
  expect(mirrorStripDropAtPoint({ x: 0, y: 0 })).toEqual({
    kind: 'strip',
    windowId: window.id,
    entryId: null,
    side: 'right'
  })
  for (const selector of ['#close svg', '#jump', '#outside']) {
    hit.mockReturnValue(document.querySelector(selector))
    expect(mirrorStripDropAtPoint({ x: 0, y: 0 })).toBeNull()
  }
  hit.mockReturnValue(document.querySelector('[role="tablist"]'))
  expect(mirrorStripDropAtPoint({ x: 0, y: 0 })?.windowId).toBe(window.id)
})
it('excludes every tab part, picker/menu and button from window drag but keeps empty title chrome draggable', () => {
  document.body.innerHTML =
    '<header><span id="empty"></span><div data-agent-hub-tab-strip><button><span>label</span><svg><path /></svg></button><button><svg /></button></div><input /><div role="menu"><span /></div><div data-agent-hub-picker><span /></div></header>'
  expect(isAgentHubMirrorWindowDragTarget(document.querySelector('#empty')!)).toBe(true)
  for (const node of document.querySelectorAll(
    '[data-agent-hub-tab-strip] *, input, [role="menu"] *, [data-agent-hub-picker] *'
  )) {
    expect(isAgentHubMirrorWindowDragTarget(node)).toBe(false)
  }
  expect(claimAgentHubMirrorGesture('window', 1)).toBe(true)
  expect(claimAgentHubMirrorGesture('tab', 1)).toBe(false)
  releaseAgentHubMirrorGesture('window')
  expect(claimAgentHubMirrorGesture('tab', 1)).toBe(true)
  expect(claimAgentHubMirrorGesture('window', 1)).toBe(false)
})
