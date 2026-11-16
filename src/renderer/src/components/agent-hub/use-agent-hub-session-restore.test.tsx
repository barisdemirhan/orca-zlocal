import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({})) }
})

import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  readAgentHubCanvasParked,
  rememberAgentHubCanvasParked,
  resetAgentHubCanvasForTest
} from './agent-hub-canvas-store'
import { rememberAgentHubMirrorOrigin } from './agent-hub-mirror-places'
import {
  closeAgentHubMirror,
  isAgentHubMirrorStageQuiet,
  minimizeAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { agentHubPaneTargetKey } from './agent-hub-pane-target'
import {
  agentHubSessionSnapshot,
  readAgentHubSessionSnapshot,
  writeAgentHubSessionSnapshot,
  type AgentHubSavedMirror
} from './agent-hub-session-snapshot'
import {
  resetAgentHubSessionRestoreForTest,
  useAgentHubSessionRestore
} from './use-agent-hub-session-restore'
import { moveAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const repo = makeRepo()
const worktree = makeWorktree()
const acknowledgeAgents = vi.fn()
const hubSettings = (experimentalAgentHub: boolean) => ({
  ...getDefaultSettings('/tmp'),
  experimentalAgentHub
})
const READY = {
  workspaceSessionReady: true,
  hydrationSucceeded: true,
  terminalStartupRestorationReady: true
}

function saved(tabId: string): AgentHubSavedMirror {
  return {
    id: `window-${tabId}`,
    tabs: [
      {
        id: `entry-${tabId}`,
        worktreeId: worktree.id,
        tabId,
        paneKey: null,
        hostIdentity: getWorktreeHostIdentity(worktree),
        title: tabId,
        agentType: null,
        origin: 'manual'
      }
    ],
    activeTabId: `entry-${tabId}`,
    minimized: false,
    minimizedAt: 0,
    geometry: { x: 40, y: 60, width: 640, height: 400 },
    keptPlace: false
  }
}

function saveSession(tabIds: string[]): void {
  writeAgentHubSessionSnapshot(
    agentHubSessionSnapshot({
      windows: tabIds.map(saved),
      canvasOpen: false,
      canvasParked: [],
      hiddenFamilyRoots: []
    })
  )
}

let root: Root | null = null

function mountHub(restoreOnLaunch = true): void {
  function Hub(): null {
    useAgentHubSessionRestore(restoreOnLaunch, false)
    return null
  }
  root = createRoot(document.createElement('div'))
  act(() => root?.render(<Hub />))
}

const windowKeys = (): string[] =>
  readAgentHubMirrors().windows.map((window) =>
    agentHubPaneTargetKey(activeAgentHubMirrorTab(window).target)
  )

beforeEach(() => {
  vi.useFakeTimers()
  useAppStore.setState({
    settings: hubSettings(true),
    activeView: 'terminal',
    activeWorktreeId: worktree.id,
    rightSidebarOpen: false,
    setRightSidebarOpen: () => {},
    acknowledgeAgents,
    workspaceSessionReady: false,
    hydrationSucceeded: false,
    terminalStartupRestorationReady: false,
    projectGroups: [],
    repos: [repo],
    worktreesByRepo: { [repo.id]: [worktree] },
    folderWorkspaces: [],
    tabsByWorktree: {
      [worktree.id]: ['tab-a', 'tab-b'].map((id) => makeTabWithIds(id, worktree.id))
    },
    terminalLayoutsByTabId: {},
    runtimePaneTitlesByTabId: {},
    agentStatusByPaneKey: acceptedAgentStatuses(),
    sleepingAgentSessionsByPaneKey: {},
    paneForegroundAgentByPaneKey: {},
    ptyIdsByTabId: {}
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  vi.useRealTimers()
  resetAgentHubSessionRestoreForTest()
  resetAgentHubCanvasForTest()
  resetAgentHubMirrorsForTest()
  acknowledgeAgents.mockClear()
  window.localStorage.clear()
})

describe('restoring the hub session on launch', () => {
  it('waits for the workspace session, then puts the mirrors back quietly', () => {
    saveSession(['tab-a', 'tab-b', 'tab-closed'])
    const focused = document.createElement('input')
    document.body.append(focused)
    focused.focus()
    mountHub()
    expect(windowKeys()).toEqual([])

    // A degraded start flips the ready flags without hydrating: still nothing.
    act(() => useAppStore.setState({ workspaceSessionReady: true }))
    expect(windowKeys()).toEqual([])

    act(() => useAppStore.setState(READY))
    expect(windowKeys()).toEqual(['tab-a', 'tab-b'])
    expect(isAgentHubMirrorStageQuiet()).toBe(true)
    expect(acknowledgeAgents).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(focused)
    focused.remove()
  })

  it('does not overwrite the snapshot before the session is ready', () => {
    saveSession(['tab-a'])
    mountHub()
    act(() => vi.advanceTimersByTime(5000))

    expect(readAgentHubSessionSnapshot()?.windows).toHaveLength(1)
  })

  it('restores nothing with the setting off, and saves the stage as it now is', () => {
    saveSession(['tab-a', 'tab-b'])
    useAppStore.setState(READY)
    mountHub(false)
    act(() => vi.advanceTimersByTime(1000))

    expect(windowKeys()).toEqual([])
    expect(readAgentHubSessionSnapshot()?.windows).toEqual([])
  })

  it('saves a change a moment later: a closed mirror leaves the snapshot, a moved one moves', () => {
    saveSession(['tab-a', 'tab-b'])
    useAppStore.setState(READY)
    mountHub()

    act(() => {
      closeAgentHubMirror(mirrorWindowIdFor('tab-a'))
      rememberAgentHubMirrorOrigin(mirrorWindowIdFor('tab-b'), {
        x: 300,
        y: 200,
        width: 700,
        height: 420
      })
    })
    expect(readAgentHubSessionSnapshot()?.windows).toHaveLength(2)
    act(() => vi.advanceTimersByTime(1000))

    expect(readAgentHubSessionSnapshot()?.windows).toMatchObject([
      { tabs: [{ tabId: 'tab-b' }], geometry: { x: 300, y: 200, width: 700, height: 420 } }
    ])
  })

  it('writes what is pending when the window unloads', () => {
    saveSession(['tab-a', 'tab-b'])
    useAppStore.setState(READY)
    mountHub()
    act(() => vi.advanceTimersByTime(1000))

    act(() => closeAgentHubMirror(mirrorWindowIdFor('tab-a')))
    window.dispatchEvent(new Event('beforeunload'))

    expect(readAgentHubSessionSnapshot()?.windows.map((mirror) => mirror.tabs[0]?.tabId)).toEqual([
      'tab-b'
    ])
  })

  it('restores once: a hub that mounts again leaves the stage alone', () => {
    saveSession(['tab-a'])
    useAppStore.setState(READY)
    mountHub()
    act(() => closeAgentHubMirror(mirrorWindowIdFor('tab-a')))
    act(() => root?.unmount())
    saveSession(['tab-b'])
    mountHub()

    expect(windowKeys()).toEqual([])
  })

  it('drops the snapshot when the hub itself is turned off', () => {
    saveSession(['tab-a'])
    useAppStore.setState(READY)
    mountHub()
    act(() => vi.advanceTimersByTime(1000))
    expect(readAgentHubSessionSnapshot()?.windows).toHaveLength(1)

    useAppStore.setState({ settings: hubSettings(false) })
    act(() => root?.unmount())
    root = null

    expect(readAgentHubSessionSnapshot()).toBeNull()
  })

  it('releases grouped and parked mirrors on disable without changing source terminals', () => {
    const tabs = ['tab-a', 'tab-b', 'tab-c'].map((id) => makeTabWithIds(id, worktree.id))
    useAppStore.setState({
      ...READY,
      tabsByWorktree: { [worktree.id]: tabs },
      ptyIdsByTabId: { 'tab-a': ['pty-a'], 'tab-b': ['pty-b'], 'tab-c': ['pty-c'] }
    })
    saveSession(tabs.map((tab) => tab.id))
    mountHub()
    const a = mirrorWindowIdFor('tab-a')
    const b = readAgentHubMirrors().windows.find(
      (window) => window.id === mirrorWindowIdFor('tab-b')
    )!
    act(() => {
      moveAgentHubMirrorTab(b.id, b.activeTabId, a, 1)
      minimizeAgentHubMirror(mirrorWindowIdFor('tab-c'))
      rememberAgentHubCanvasParked([a])
    })
    const sources = useAppStore.getState()
    expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
    expect(readAgentHubMirrors().chips).toHaveLength(1)

    act(() => {
      useAppStore.setState({ settings: hubSettings(false) })
      root?.unmount()
    })
    root = null
    expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
    expect(readAgentHubCanvasParked()).toEqual([])
    expect(readAgentHubSessionSnapshot()).toBeNull()
    expect(useAppStore.getState().tabsByWorktree).toBe(sources.tabsByWorktree)
    expect(useAppStore.getState().ptyIdsByTabId).toBe(sources.ptyIdsByTabId)

    useAppStore.setState({ settings: hubSettings(true) })
    mountHub()
    expect(readAgentHubMirrors()).toEqual({ windows: [], chips: [] })
  })
})
