/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  type Shell = {
    activeView: string
    activeWorktreeId: string | null
    rightSidebarOpen: boolean
    setRightSidebarOpen: (open: boolean) => void
  }
  return {
    useAppStore: create<Shell>((set) => ({
      activeView: 'terminal',
      activeWorktreeId: 'worktree-a',
      rightSidebarOpen: false,
      setRightSidebarOpen: (open) => set({ rightSidebarOpen: open })
    }))
  }
})

import { useAppStore } from '@/store'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import {
  closeAgentHubCanvas,
  isAgentHubCanvasOpen,
  openAgentHubCanvas,
  resetAgentHubCanvasForTest,
  toggleAgentHubCanvas
} from './agent-hub-canvas-store'
import { readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import {
  minimizeAgentHubMirror,
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  setAgentHubMirrorWindowCap,
  toggleAgentHubMirrorFocus
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

function target(tabId: string): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: `${tabId}:leaf`,
    title: tabId,
    agentType: 'claude'
  }
}

const windowKeys = (): string[] => readAgentHubMirrors().windows.map((open) => open.paneKey ?? '')
const chipKeys = (): string[] =>
  readAgentHubMirrors().chips.map((chip) => chip.target.paneKey ?? '')

/** Leaves the canvas and lands its mirrors in the tray, as each window does after its flight. */
function leaveCanvas(): void {
  const onCanvas = windowKeys()
  closeAgentHubCanvas()
  onCanvas.forEach(minimizeAgentHubMirror)
}

afterEach(() => {
  resetAgentHubCanvasForTest()
  resetAgentHubMirrorsForTest()
  useAppStore.setState({
    activeView: 'terminal',
    activeWorktreeId: 'worktree-a',
    rightSidebarOpen: false
  })
})

describe('the right sidebar under the canvas', () => {
  it('closes with the canvas up, stays closed whoever asks, and returns as it was', () => {
    useAppStore.setState({ rightSidebarOpen: true })

    openAgentHubCanvas()
    expect(useAppStore.getState().rightSidebarOpen).toBe(false)

    useAppStore.getState().setRightSidebarOpen(true)
    expect(useAppStore.getState().rightSidebarOpen).toBe(false)

    closeAgentHubCanvas()
    expect(useAppStore.getState().rightSidebarOpen).toBe(true)
  })

  it('stays closed afterwards when it was closed before', () => {
    openAgentHubCanvas()
    useAppStore.getState().setRightSidebarOpen(true)
    closeAgentHubCanvas()

    expect(useAppStore.getState().rightSidebarOpen).toBe(false)
    // The canvas no longer holds it shut.
    useAppStore.getState().setRightSidebarOpen(true)
    expect(useAppStore.getState().rightSidebarOpen).toBe(true)
  })
})

describe('leaving the canvas', () => {
  it('happens when the user goes to another page or another workspace', () => {
    useAppStore.setState({ rightSidebarOpen: true })
    openAgentHubCanvas()
    useAppStore.setState({ activeView: 'tasks' })
    expect(isAgentHubCanvasOpen()).toBe(false)
    expect(useAppStore.getState().rightSidebarOpen).toBe(true)

    openAgentHubCanvas()
    useAppStore.setState({ activeWorktreeId: 'worktree-b' })
    expect(isAgentHubCanvasOpen()).toBe(false)
  })

  it('brings the mirrors it parked back in their order when the canvas returns', () => {
    openAgentHubMirror(target('a'))
    openAgentHubMirror(target('b'))
    openAgentHubCanvas()

    leaveCanvas()
    expect(windowKeys()).toEqual([])
    expect(chipKeys()).toEqual(['a:leaf', 'b:leaf'])

    toggleAgentHubCanvas()
    expect(windowKeys()).toEqual(['a:leaf', 'b:leaf'])
    expect(chipKeys()).toEqual([])
  })

  it('keeps a mirror opened on the way back in front of the returning ones', () => {
    openAgentHubMirror(target('a'))
    openAgentHubMirror(target('b'))
    openAgentHubCanvas()
    leaveCanvas()

    openAgentHubMirror(target('c'))
    openAgentHubCanvas()

    expect(windowKeys()).toEqual(['a:leaf', 'b:leaf', 'c:leaf'])
  })

  it('brings back only as many as the window cap has room for, the front ones first', () => {
    setAgentHubMirrorWindowCap(2)
    openAgentHubMirror(target('a'))
    openAgentHubMirror(target('b'))
    openAgentHubCanvas()
    leaveCanvas()

    openAgentHubMirror(target('c'))
    openAgentHubCanvas()

    expect(windowKeys()).toEqual(['b:leaf', 'c:leaf'])
    expect(chipKeys()).toEqual(['a:leaf'])
  })

  it('leaves a mirror closed in the meantime closed', () => {
    openAgentHubMirror(target('a'))
    openAgentHubCanvas()
    closeAgentHubCanvas()
    // Never landed in the tray: it is not a chip, so nothing returns.
    resetAgentHubMirrorsForTest()

    openAgentHubCanvas()
    expect(windowKeys()).toEqual([])
  })

  it('ends a focus when the canvas is left', () => {
    openAgentHubCanvas()
    openAgentHubMirror(target('tab-a'))
    toggleAgentHubMirrorFocus('tab-a:leaf')
    expect(readAgentHubMirrorFocus()).toBe('tab-a:leaf')

    closeAgentHubCanvas()

    expect(readAgentHubMirrorFocus()).toBeNull()
  })
})
