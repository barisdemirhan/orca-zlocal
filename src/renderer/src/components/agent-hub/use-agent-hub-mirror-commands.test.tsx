/** @vitest-environment happy-dom */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { getAgentHubCommands } from './agent-hub-commands'
import { useAgentHubMirrorCommands } from './use-agent-hub-mirror-commands'
import { openAgentHubMirror, resetAgentHubMirrorsForTest } from './agent-hub-mirror-store'
import { openAgentHubCanvas, resetAgentHubCanvasForTest } from './agent-hub-canvas-store'
import { readAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import { makeWorktree, makeTabWithIds } from '../activity/ActivityPrototypePage-test-fixtures'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      activeView: 'terminal',
      activeWorktreeId: 'wt-1',
      rightSidebarOpen: false
    }))
  }
})
afterEach(() => {
  cleanup()
  resetAgentHubCanvasForTest()
  resetAgentHubMirrorsForTest()
})

it('focuses/unfocuses the front canvas mirror and falls through outside the canvas', () => {
  const worktree = makeWorktree()
  const target = {
    worktree,
    repo: null,
    tab: makeTabWithIds('tab-1', worktree.id),
    paneKey: 'tab-1:leaf',
    title: 'Agent',
    agentType: null
  }
  openAgentHubMirror(target)
  const commands = {
    toggle: vi.fn(),
    jumpToNextWaiting: vi.fn(),
    toggleMirrors: vi.fn(),
    toggleCanvas: vi.fn(),
    arrangeMirrors: vi.fn()
  }
  function Hub() {
    useAgentHubMirrorCommands(commands, vi.fn())
    return null
  }
  render(<Hub />)
  expect(getAgentHubCommands()?.focusMirror).toBeNull()
  act(openAgentHubCanvas)
  act(() => getAgentHubCommands()?.focusMirror?.())
  expect(readAgentHubMirrorFocus()).toBe('tab-1:leaf')
  act(() => getAgentHubCommands()?.focusMirror?.())
  expect(readAgentHubMirrorFocus()).toBeNull()
})
