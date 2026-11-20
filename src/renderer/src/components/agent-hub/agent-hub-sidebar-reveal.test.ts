import type * as MirrorSource from './agent-hub-mirror-source'
/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { SCROLL_TO_CURRENT_WORKSPACE_REVEAL_REQUEST_EVENT } from '@/lib/workspace/navigation/scroll-to-current-workspace-status'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/components/floating-terminal/workspace/floating-workspace-open-intent'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import {
  canRevealAgentHubTargetInSidebar,
  revealAgentHubTargetInSidebar
} from './agent-hub-sidebar-reveal'
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
    floatingWorkspacePanelOpen: false,
    settings: { experimentalAgentHub: true },
    setSidebarOpen: vi.fn((sidebarOpen: boolean) => useAppStore.setState({ sidebarOpen }))
  }))
  return { useAppStore }
})

afterEach(() => {
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
  const { settings } = useAppStore.getState()
  if (settings) {
    useAppStore.setState({
      floatingWorkspacePanelOpen: true,
      settings: { ...settings, floatingTerminalEnabled: true }
    })
  }
  const hide = vi.fn()
  const reveal = vi.fn()
  window.addEventListener(TOGGLE_FLOATING_TERMINAL_EVENT, hide)
  window.addEventListener(SCROLL_TO_CURRENT_WORKSPACE_REVEAL_REQUEST_EVENT, reveal)
  revealAgentHubTargetInSidebar(target)
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
  useAppStore.setState({ floatingWorkspacePanelOpen: false })
})

it('has no sidebar row for floating workspace mirrors', () => {
  const worktree = { ...makeWorktree(), id: FLOATING_TERMINAL_WORKTREE_ID }
  const target: AgentHubPaneTarget = {
    worktree,
    tab: makeTabWithIds('floating', worktree.id),
    repo: null,
    paneKey: null,
    title: 'Terminal',
    agentType: null
  }
  expect(canRevealAgentHubTargetInSidebar(target)).toBe(false)
  expect(canRevealAgentHubTargetInSidebar({ ...target, worktree: makeWorktree() })).toBe(true)
})

vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
