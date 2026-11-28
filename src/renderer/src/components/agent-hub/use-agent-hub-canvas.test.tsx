import type * as MirrorSource from './agent-hub-mirror-source'
import { mirrorWindowIdFor } from './agent-hub-mirror-test-fixtures'
/** @vitest-environment happy-dom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      activeView: 'terminal',
      activeWorktreeId: 'worktree-a',
      rightSidebarOpen: false,
      setRightSidebarOpen: () => {}
    }))
  }
})

import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import {
  closeAgentHubCanvas,
  isAgentHubCanvasOpen,
  openAgentHubCanvas,
  resetAgentHubCanvasForTest
} from './agent-hub-canvas-store'
import {
  minimizeAgentHubMirror,
  openAgentHubMirror,
  resetAgentHubMirrorsForTest,
  restoreAgentHubMirror
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubCanvas } from './use-agent-hub-canvas'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

let root: Root | null = null

afterEach(() => {
  act(() => root?.unmount())
  root = null
  resetAgentHubCanvasForTest()
  resetAgentHubMirrorsForTest()
})

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

function renderCanvas(enabled: boolean): () => boolean {
  let shown = false
  function Hub({ on }: { on: boolean }): null {
    shown = useAgentHubCanvas(on)
    return null
  }
  root ??= createRoot(document.createElement('div'))
  act(() => root?.render(<Hub on={enabled} />))
  return () => shown
}

describe('the canvas opens only by explicit action', () => {
  it('stays away while the setting is off', () => {
    const shown = renderCanvas(false)
    act(() => openAgentHubMirror(target('tab-a')))

    expect(shown()).toBe(false)
    expect(isAgentHubCanvasOpen()).toBe(false)
  })

  it('never navigates when a mirror opens or comes back from the tray', () => {
    const shown = renderCanvas(true)
    expect(shown()).toBe(false)

    act(() => openAgentHubMirror(target('tab-a')))
    expect(shown()).toBe(false)

    act(() => {
      minimizeAgentHubMirror(mirrorWindowIdFor('tab-a:leaf'))
      closeAgentHubCanvas()
    })
    expect(shown()).toBe(false)

    act(() => restoreAgentHubMirror(mirrorWindowIdFor('tab-a:leaf')))
    expect(shown()).toBe(false)
  })

  it('does not navigate when enabling the canvas; explicit opening works and disabling closes it', () => {
    renderCanvas(false)
    act(() => openAgentHubMirror(target('tab-a')))

    const shown = renderCanvas(true)
    expect(shown()).toBe(false)
    act(openAgentHubCanvas)
    expect(shown()).toBe(true)

    renderCanvas(false)
    expect(isAgentHubCanvasOpen()).toBe(false)
  })

  it('leaves on a click on the current workspace in the left sidebar', () => {
    const sidebar = document.createElement('div')
    sidebar.innerHTML =
      '<div data-worktree-sidebar><div data-worktree-card-surface="true" data-worktree-card-active="primary"></div></div>'
    document.body.append(sidebar)
    const shown = renderCanvas(true)
    act(() => {
      openAgentHubMirror(target('tab-a'))
      openAgentHubCanvas()
    })
    expect(shown()).toBe(true)

    act(() => {
      sidebar
        .querySelector('[data-worktree-card-surface]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(shown()).toBe(false)
    sidebar.remove()
  })
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
