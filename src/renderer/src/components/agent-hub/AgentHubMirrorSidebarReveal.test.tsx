/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { SCROLL_TO_CURRENT_WORKSPACE_REVEAL_REQUEST_EVENT } from '@/lib/scroll-to-current-workspace-status'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubMirrorSidebarReveal } from './AgentHubMirrorSidebarReveal'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const useAppStore = create(() => ({
    sidebarOpen: false,
    activeWorktreeId: 'keep-active',
    settings: { experimentalAgentHub: true },
    setSidebarOpen: vi.fn((sidebarOpen: boolean) => useAppStore.setState({ sidebarOpen }))
  }))
  return { useAppStore }
})

afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it.each(['git', 'folder'])('opens the sidebar and parks all mirrors for a %s workspace', (kind) => {
  useAppStore.setState({ sidebarOpen: false })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  const worktree = {
    ...makeWorktree(),
    id: kind === 'folder' ? 'folder:example' : 'git-workspace',
    hostId: 'ssh:dev' as const
  }
  const target: AgentHubPaneTarget = {
    worktree,
    tab: makeTabWithIds('tab', worktree.id),
    repo: null,
    paneKey: null,
    title: 'Terminal',
    agentType: null
  }
  openAgentHubMirror(target)
  openAgentHubMirror({ ...target, tab: makeTabWithIds('tab-2', worktree.id) })
  const panel = document.createElement('div')
  panel.setAttribute('data-floating-terminal-panel', '')
  panel.setAttribute('aria-hidden', 'false')
  document.body.append(panel)
  const hide = vi.fn()
  const reveal = vi.fn()
  window.addEventListener(TOGGLE_FLOATING_TERMINAL_EVENT, hide)
  window.addEventListener(SCROLL_TO_CURRENT_WORKSPACE_REVEAL_REQUEST_EVENT, reveal)
  render(
    <TooltipProvider>
      <AgentHubMirrorSidebarReveal target={target} />
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show in sidebar' }))
  expect(useAppStore.getState().sidebarOpen).toBe(true)
  expect(readAgentHubMirrors().windows).toHaveLength(0)
  expect(readAgentHubMirrors().chips).toHaveLength(2)
  expect(hide).toHaveBeenCalledTimes(1)
  expect(reveal.mock.calls[0]?.[0].detail.target).toEqual({
    type: 'workspace',
    worktreeId: worktree.id,
    executionHostId: 'ssh:dev'
  })
  expect(useAppStore.getState().activeWorktreeId).toBe('keep-active')
  window.removeEventListener(TOGGLE_FLOATING_TERMINAL_EVENT, hide)
  window.removeEventListener(SCROLL_TO_CURRENT_WORKSPACE_REVEAL_REQUEST_EVENT, reveal)
  panel.remove()
})

it('omits floating workspace mirrors', () => {
  const worktree = { ...makeWorktree(), id: FLOATING_TERMINAL_WORKTREE_ID }
  const target: AgentHubPaneTarget = {
    worktree,
    tab: makeTabWithIds('floating', worktree.id),
    repo: null,
    paneKey: null,
    title: 'Terminal',
    agentType: null
  }
  render(
    <TooltipProvider>
      <AgentHubMirrorSidebarReveal target={target} />
    </TooltipProvider>
  )
  expect(screen.queryByRole('button')).toBeNull()
})
