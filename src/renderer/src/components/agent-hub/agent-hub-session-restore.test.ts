import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import type * as MirrorSource from './agent-hub-mirror-source'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      activeView: 'terminal',
      activeWorktreeId: 'wt-1',
      rightSidebarOpen: false,
      setRightSidebarOpen: () => {}
    }))
  }
})

import type { TerminalLayoutSnapshot } from '../../../../shared/workspace-layout/terminal-tab-types'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  closeAgentHubCanvas,
  openAgentHubCanvas,
  readAgentHubCanvasParked,
  resetAgentHubCanvasForTest
} from './agent-hub-canvas-store'
import {
  readAgentHubHiddenFamilyBars,
  setAgentHubHiddenFamilyBars,
  toggleAgentHubFamilyBar
} from './agent-hub-family-bar'
import {
  keepAgentHubMirrorPlace,
  readAgentHubMirrorOrigin,
  rememberAgentHubMirrorOrigin
} from './agent-hub-mirror-places'
import {
  minimizeAgentHubMirror,
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  toggleAgentHubMirrorFocus
} from './agent-hub-mirror-store'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  applyAgentHubSession,
  captureAgentHubSession,
  resolveAgentHubSession
} from './agent-hub-session-restore'
import {
  agentHubSessionSnapshot,
  parseAgentHubSessionSnapshot,
  type AgentHubSavedMirror,
  type AgentHubSavedMirrorTab,
  type AgentHubSessionSnapshot
} from './agent-hub-session-snapshot'

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'
const VIEWPORT = { width: 1600, height: 1000 }
const PLACE = { x: 40, y: 60, width: 640, height: 400 }

const repo = makeRepo()
const worktree = makeWorktree()

function layout(leafId: string): TerminalLayoutSnapshot {
  return { root: { type: 'leaf', leafId }, activeLeafId: leafId, expandedLeafId: null }
}

/** A store with one workspace holding these tabs, each a single pane. */
function storeWith(tabs: Record<string, string>) {
  return {
    projectGroups: [],
    repos: [repo],
    worktreesByRepo: { [repo.id]: [worktree] },
    folderWorkspaces: [],
    tabsByWorktree: {
      [worktree.id]: Object.keys(tabs).map((id) => makeTabWithIds(id, worktree.id))
    },
    terminalLayoutsByTabId: Object.fromEntries(
      Object.entries(tabs).map(([id, leafId]) => [id, layout(leafId)])
    ),
    runtimePaneTitlesByTabId: {},
    agentStatusByPaneKey: acceptedAgentStatuses(),
    sleepingAgentSessionsByPaneKey: {},
    paneForegroundAgentByPaneKey: {},
    ptyIdsByTabId: {}
  }
}

function saved(
  tabId: string,
  overrides: Partial<AgentHubSavedMirror & AgentHubSavedMirrorTab> = {}
): AgentHubSavedMirror {
  const {
    paneKey = null,
    title = tabId,
    agentType = null,
    worktreeId = worktree.id,
    ...window
  } = overrides
  return {
    id: `window-${tabId}`,
    tabs: [
      {
        id: `entry-${tabId}`,
        worktreeId,
        tabId,
        paneKey,
        hostIdentity:
          worktreeId === worktree.id ? getWorktreeHostIdentity(worktree) : `|${worktreeId}`,
        title,
        agentType,
        origin: 'manual'
      }
    ],
    activeTabId: `entry-${tabId}`,
    minimized: false,
    minimizedAt: 0,
    geometry: PLACE,
    keptPlace: false,
    ...window
  }
}

function snapshotOf(
  mirrors: AgentHubSavedMirror[],
  rest: Partial<AgentHubSessionSnapshot> = {}
): AgentHubSessionSnapshot {
  return agentHubSessionSnapshot({
    windows: mirrors,
    canvasOpen: false,
    canvasParked: [],
    hiddenFamilyRoots: [],
    ...rest
  })
}

const options = { canvas: false, viewport: VIEWPORT, now: 1000 }
const keysOf = (targets: readonly AgentHubPaneTarget[]): string[] =>
  targets.map(agentHubPaneTargetKey)
const windowKeys = (): string[] =>
  keysOf(readAgentHubMirrors().windows.map((window) => activeAgentHubMirrorTab(window).target))
const chipKeys = (): string[] =>
  keysOf(readAgentHubMirrors().chips.map((chip) => activeAgentHubMirrorTab(chip.window).target))

afterEach(() => {
  resetAgentHubCanvasForTest()
  resetAgentHubMirrorsForTest()
  setAgentHubHiddenFamilyBars([])
})

describe('resolving a saved hub session against the store', () => {
  it('rebuilds each mirror from the live workspace, project and tab', () => {
    const state = storeWith({ 'tab-a': LEAF_A })
    const paneKey = `tab-a:${LEAF_A}`
    const { mirrors } = resolveAgentHubSession(
      snapshotOf([saved('tab-a', { paneKey, title: 'Fix the build', agentType: 'claude' })]),
      state,
      options
    )

    expect(mirrors).toHaveLength(1)
    expect(mirrors[0]?.window.tabs[0]?.target).toMatchObject({
      paneKey,
      title: 'Fix the build',
      agentType: 'claude'
    })
    expect(mirrors[0]?.window.tabs[0]?.target.tab).toBe(state.tabsByWorktree[worktree.id]?.[0])
    expect(mirrors[0]?.window.tabs[0]?.target.worktree).toBe(worktree)
    expect(mirrors[0]?.window.tabs[0]?.target.repo).toBe(repo)
  })

  it('leaves out a mirror whose tab or workspace is gone and keeps the others', () => {
    const { mirrors } = resolveAgentHubSession(
      snapshotOf([
        saved('tab-closed'),
        saved('tab-a'),
        saved('tab-b', { worktreeId: 'wt-archived' })
      ]),
      storeWith({ 'tab-a': LEAF_A, 'tab-b': LEAF_B }),
      options
    )

    expect(keysOf(mirrors.map((mirror) => activeAgentHubMirrorTab(mirror.window).target))).toEqual([
      'tab-a'
    ])
  })

  it('follows the tab when the saved pane was closed, without doubling its mirror', () => {
    const { mirrors } = resolveAgentHubSession(
      snapshotOf([saved('tab-a', { paneKey: `tab-a:${LEAF_B}` }), saved('tab-a')]),
      storeWith({ 'tab-a': LEAF_A }),
      options
    )

    expect(mirrors).toHaveLength(1)
    expect(mirrors[0]?.window.tabs[0]?.target.paneKey).toBeNull()
  })

  it('pulls a place saved on a larger display into the window as it is now', () => {
    const { mirrors } = resolveAgentHubSession(
      snapshotOf([saved('tab-a', { geometry: { x: 3000, y: 1800, width: 2400, height: 1500 } })]),
      storeWith({ 'tab-a': LEAF_A }),
      { ...options, viewport: { width: 1200, height: 800 } }
    )
    const place = mirrors[0]?.place?.geometry

    expect(place).toBeDefined()
    expect((place?.x ?? 0) + (place?.width ?? 0)).toBeLessThanOrEqual(1200)
    expect((place?.y ?? 0) + (place?.height ?? 0)).toBeLessThanOrEqual(800)
    expect(place?.x).toBeGreaterThanOrEqual(0)
  })

  it('keeps the windows parked when the canvas was left, and reopens a canvas left open', () => {
    const state = storeWith({ 'tab-a': LEAF_A, 'tab-b': LEAF_B })
    const snapshot = snapshotOf([saved('tab-a'), saved('tab-b', { minimized: true })], {
      canvasParked: ['window-tab-b', 'window-tab-gone']
    })

    const left = resolveAgentHubSession(snapshot, state, { ...options, canvas: true })
    expect(left.mirrors.map((mirror) => mirror.minimized)).toEqual([true, true])
    expect(left.canvasParked).toEqual(['window-tab-b'])

    // With the canvas off the mirrors float as they did, and nothing waits for a canvas.
    const floating = resolveAgentHubSession(snapshot, state, options)
    expect(floating.mirrors.map((mirror) => mirror.minimized)).toEqual([false, true])
    expect(floating.canvasParked).toEqual([])
    expect(floating.canvasOpen).toBe(false)

    // Left on the canvas: it opens again with its windows where they were.
    const onCanvas = resolveAgentHubSession(
      snapshotOf([saved('tab-a'), saved('tab-b', { minimized: true })], { canvasOpen: true }),
      state,
      { ...options, canvas: true }
    )
    expect(onCanvas.canvasOpen).toBe(true)
    expect(onCanvas.mirrors.map((mirror) => mirror.minimized)).toEqual([false, true])
  })

  it('drops hidden worker bars of tabs that are gone', () => {
    const restored = resolveAgentHubSession(
      snapshotOf([], {
        hiddenFamilyRoots: [`tab-a:${LEAF_A}`, `tab-gone:${LEAF_B}`, 'not-a-pane']
      }),
      storeWith({ 'tab-a': LEAF_A }),
      options
    )

    expect(restored.hiddenFamilyRoots).toEqual([`tab-a:${LEAF_A}`])
  })
})

describe('a hub session saved and put back', () => {
  const state = storeWith({ 'tab-a': LEAF_A, 'tab-b': LEAF_B, 'tab-c': LEAF_A })
  const liveTarget = (tabId: string): AgentHubPaneTarget => ({
    worktree,
    repo,
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: null,
    title: tabId,
    agentType: null
  })

  it('returns the same windows, tray, places and bars', () => {
    for (const tabId of ['tab-a', 'tab-b', 'tab-c']) {
      openAgentHubMirror(liveTarget(tabId))
      rememberAgentHubMirrorOrigin(mirrorWindowIdFor(tabId), {
        ...PLACE,
        x: PLACE.x + tabId.charCodeAt(4)
      })
    }
    keepAgentHubMirrorPlace(mirrorWindowIdFor('tab-c'))
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-b'))
    toggleAgentHubFamilyBar(`tab-a:${LEAF_A}`)
    const snapshot = captureAgentHubSession()
    const ids = ['tab-a', 'tab-b', 'tab-c'].map(mirrorWindowIdFor)
    const places = ids.map(readAgentHubMirrorOrigin)

    resetAgentHubMirrorsForTest()
    setAgentHubHiddenFamilyBars([])
    applyAgentHubSession(resolveAgentHubSession(snapshot, state, options))

    expect(windowKeys()).toEqual(['tab-a', 'tab-c'])
    expect(chipKeys()).toEqual(['tab-b'])
    expect(ids.map(readAgentHubMirrorOrigin)).toEqual(places)
    expect(captureAgentHubSession().windows.map((mirror) => mirror.keptPlace)).toEqual([
      false,
      false,
      true
    ])
    expect([...readAgentHubHiddenFamilyBars()]).toEqual([`tab-a:${LEAF_A}`])
  })

  it('saves a focused mirror at its own place, not the box it is enlarged to', () => {
    openAgentHubMirror(liveTarget('tab-a'))
    rememberAgentHubMirrorOrigin(mirrorWindowIdFor('tab-a'), PLACE)
    toggleAgentHubMirrorFocus(mirrorWindowIdFor('tab-a'))

    expect(captureAgentHubSession().windows[0]?.geometry).toEqual(PLACE)
  })

  it('saves the canvas as left, with the mirrors it will bring back', () => {
    openAgentHubMirror(liveTarget('tab-a'))
    openAgentHubCanvas()
    expect(captureAgentHubSession().canvasOpen).toBe(true)

    closeAgentHubCanvas()
    minimizeAgentHubMirror(mirrorWindowIdFor('tab-a'))
    const id = mirrorWindowIdFor('tab-a')
    const snapshot = captureAgentHubSession()
    expect(snapshot).toMatchObject({ canvasOpen: false, canvasParked: [id] })

    resetAgentHubCanvasForTest()
    resetAgentHubMirrorsForTest()
    applyAgentHubSession(resolveAgentHubSession(snapshot, state, { ...options, canvas: true }))
    expect(chipKeys()).toEqual(['tab-a'])
    expect(readAgentHubCanvasParked()).toEqual([id])

    // Coming back to the canvas brings the mirror it parked.
    openAgentHubCanvas()
    expect(windowKeys()).toEqual(['tab-a'])
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))

it('round-trips pin state through persisted groups and prunes closed sources while accepting old unpinned entries', () => {
  const group = saved('tab-a')
  group.tabs.push({ ...saved('tab-b').tabs[0]!, isPinned: true })
  group.tabs.push(saved('closed').tabs[0]!)
  const parsed = parseAgentHubSessionSnapshot(JSON.parse(JSON.stringify(snapshotOf([group]))))!
  const state = storeWith({ 'tab-a': LEAF_A, 'tab-b': LEAF_B })
  applyAgentHubSession(resolveAgentHubSession(parsed, state, options))
  const restored = readAgentHubMirrors().windows[0]!
  expect(restored.tabs.map((tab) => tab.target.tab.id)).toEqual(['tab-b', 'tab-a'])
  expect(restored.tabs[0]).toMatchObject({ isPinned: true })
  expect(restored.tabs[1]?.isPinned).not.toBe(true)
  minimizeAgentHubMirror(restored.id)
  const captured = captureAgentHubSession()
  expect(captured.windows[0]?.tabs[0]).toMatchObject({ tabId: 'tab-b', isPinned: true })
  resetAgentHubMirrorsForTest()
  applyAgentHubSession(resolveAgentHubSession(captured, state, options))
  expect(readAgentHubMirrors().chips[0]?.window.tabs[0]).toMatchObject({ isPinned: true })
})
