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

import type { TerminalLayoutSnapshot } from '../../../../shared/terminal-tab-types'
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
  type AgentHubSavedMirror,
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
    agentStatusByPaneKey: {},
    retainedAgentsByPaneKey: {},
    sleepingAgentSessionsByPaneKey: {},
    paneForegroundAgentByPaneKey: {},
    ptyIdsByTabId: {}
  }
}

function saved(tabId: string, overrides: Partial<AgentHubSavedMirror> = {}): AgentHubSavedMirror {
  return {
    worktreeId: worktree.id,
    tabId,
    paneKey: null,
    title: tabId,
    agentType: null,
    minimized: false,
    minimizedAt: 0,
    geometry: PLACE,
    keptPlace: false,
    ...overrides
  }
}

function snapshotOf(
  mirrors: AgentHubSavedMirror[],
  rest: Partial<AgentHubSessionSnapshot> = {}
): AgentHubSessionSnapshot {
  return agentHubSessionSnapshot({
    mirrors,
    canvasOpen: false,
    canvasParked: [],
    hiddenFamilyRoots: [],
    ...rest
  })
}

const options = { canvas: false, viewport: VIEWPORT, now: 1000 }
const keysOf = (targets: readonly AgentHubPaneTarget[]): string[] =>
  targets.map(agentHubPaneTargetKey)
const windowKeys = (): string[] => keysOf(readAgentHubMirrors().windows)
const chipKeys = (): string[] => keysOf(readAgentHubMirrors().chips.map((chip) => chip.target))

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
    expect(mirrors[0]?.target).toMatchObject({
      paneKey,
      title: 'Fix the build',
      agentType: 'claude'
    })
    expect(mirrors[0]?.target.tab).toBe(state.tabsByWorktree[worktree.id]?.[0])
    expect(mirrors[0]?.target.worktree).toBe(worktree)
    expect(mirrors[0]?.target.repo).toBe(repo)
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

    expect(keysOf(mirrors.map((mirror) => mirror.target))).toEqual(['tab-a'])
  })

  it('follows the tab when the saved pane was closed, without doubling its mirror', () => {
    const { mirrors } = resolveAgentHubSession(
      snapshotOf([saved('tab-a', { paneKey: `tab-a:${LEAF_B}` }), saved('tab-a')]),
      storeWith({ 'tab-a': LEAF_A }),
      options
    )

    expect(mirrors).toHaveLength(1)
    expect(mirrors[0]?.target.paneKey).toBeNull()
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

  it('keeps the windows parked when the canvas is on and was left', () => {
    const state = storeWith({ 'tab-a': LEAF_A, 'tab-b': LEAF_B })
    const snapshot = snapshotOf([saved('tab-a'), saved('tab-b', { minimized: true })], {
      canvasParked: ['tab-b', 'tab-gone']
    })

    const left = resolveAgentHubSession(snapshot, state, { ...options, canvas: true })
    expect(left.mirrors.map((mirror) => mirror.minimized)).toEqual([true, true])
    expect(left.canvasParked).toEqual(['tab-b'])

    // With the canvas off the mirrors float as they did, and nothing waits for a canvas.
    const floating = resolveAgentHubSession(snapshot, state, options)
    expect(floating.mirrors.map((mirror) => mirror.minimized)).toEqual([false, true])
    expect(floating.canvasParked).toEqual([])
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
      rememberAgentHubMirrorOrigin(tabId, { ...PLACE, x: PLACE.x + tabId.charCodeAt(4) })
    }
    keepAgentHubMirrorPlace('tab-c')
    minimizeAgentHubMirror('tab-b')
    toggleAgentHubFamilyBar(`tab-a:${LEAF_A}`)
    const snapshot = captureAgentHubSession()
    const places = ['tab-a', 'tab-b', 'tab-c'].map(readAgentHubMirrorOrigin)

    resetAgentHubMirrorsForTest()
    setAgentHubHiddenFamilyBars([])
    applyAgentHubSession(resolveAgentHubSession(snapshot, state, options))

    expect(windowKeys()).toEqual(['tab-a', 'tab-c'])
    expect(chipKeys()).toEqual(['tab-b'])
    expect(['tab-a', 'tab-b', 'tab-c'].map(readAgentHubMirrorOrigin)).toEqual(places)
    expect(captureAgentHubSession().mirrors.map((mirror) => mirror.keptPlace)).toEqual([
      false,
      false,
      true
    ])
    expect([...readAgentHubHiddenFamilyBars()]).toEqual([`tab-a:${LEAF_A}`])
  })

  it('saves a focused mirror at its own place, not the box it is enlarged to', () => {
    openAgentHubMirror(liveTarget('tab-a'))
    rememberAgentHubMirrorOrigin('tab-a', PLACE)
    toggleAgentHubMirrorFocus('tab-a')

    expect(captureAgentHubSession().mirrors[0]?.geometry).toEqual(PLACE)
  })

  it('saves the canvas as left, with the mirrors it will bring back', () => {
    openAgentHubMirror(liveTarget('tab-a'))
    openAgentHubCanvas()
    expect(captureAgentHubSession().canvasOpen).toBe(true)

    closeAgentHubCanvas()
    minimizeAgentHubMirror('tab-a')
    const snapshot = captureAgentHubSession()
    expect(snapshot).toMatchObject({ canvasOpen: false, canvasParked: ['tab-a'] })

    resetAgentHubCanvasForTest()
    resetAgentHubMirrorsForTest()
    applyAgentHubSession(resolveAgentHubSession(snapshot, state, { ...options, canvas: true }))
    expect(chipKeys()).toEqual(['tab-a'])
    expect(readAgentHubCanvasParked()).toEqual(['tab-a'])

    // Coming back to the canvas brings the mirror it parked.
    openAgentHubCanvas()
    expect(windowKeys()).toEqual(['tab-a'])
  })
})
