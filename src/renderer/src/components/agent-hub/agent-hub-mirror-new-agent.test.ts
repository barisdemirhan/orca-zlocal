/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  adoptAgentBackgroundSessionTab,
  reserveAgentBackgroundSessionIdentity
} from '@/lib/adopt-agent-background-session-tab'
import { buildAgentStartupPlan } from '@/lib/tui-agent-startup'
import type { TerminalLayoutSnapshot } from '../../../../shared/terminal-tab-types'
import { makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { startAgentInAgentHubMirror } from './agent-hub-mirror-new-agent'
import {
  openAgentHubMirror,
  pruneClosedAgentHubMirrorSources,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'

const fixture = vi.hoisted(() => {
  const state: { initialLayout: TerminalLayoutSnapshot | null } = { initialLayout: null }
  return state
})
vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/slices/store-test-helpers')
  return { useAppStore: createTestStore() }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/launch-agent-background-session', () => ({
  launchAgentBackgroundSession: async ({
    agent,
    worktreeId
  }: {
    agent: 'claude' | 'claude-agent-teams' | 'codex'
    worktreeId: string
  }) => {
    const startupPlan = buildAgentStartupPlan({
      agent,
      prompt: '',
      cmdOverrides: {},
      platform: 'darwin',
      allowEmptyPromptLaunch: true
    })
    if (!startupPlan) {
      throw new Error('No startup plan')
    }
    const store = useAppStore.getState()
    const reserved = reserveAgentBackgroundSessionIdentity({
      store,
      agentType: agent,
      worktreeId,
      launchConfig: startupPlan.launchConfig,
      env: startupPlan.env
    })
    // Terminal mounts retain the first store-visible layout in initialLayoutRef.
    const stop = useAppStore.subscribe((state) => {
      fixture.initialLayout ??= state.terminalLayoutsByTabId[reserved.reservedTabId] ?? null
    })
    try {
      const adopted = await adoptAgentBackgroundSessionTab({
        store,
        worktreeId,
        ...reserved,
        ptyId: 'pty-agent',
        launchConfig: startupPlan.launchConfig,
        runtimeTarget: { kind: 'local' },
        runtimeTerminalHandle: null,
        onRetire: () => {}
      })
      return adopted
        ? {
            tabId: adopted.tab.id,
            paneKey: adopted.paneKey,
            ptyId: 'pty-agent',
            startupPlan,
            terminalOwnership: adopted.terminalOwnership
          }
        : null
    } finally {
      stop()
    }
  }
}))

const initial = useAppStore.getState()
beforeEach(() => {
  Object.defineProperty(window, 'api', {
    value: { worktrees: { updateMeta: vi.fn(async () => {}) } },
    configurable: true
  })
  fixture.initialLayout = null
  resetAgentHubMirrorsForTest()
  useAppStore.setState(initial)
})
afterEach(() => {
  resetAgentHubMirrorsForTest()
  useAppStore.setState(initial)
})

it.each(['claude', 'claude-agent-teams', 'codex'] as const)(
  'keeps the new %s mirror tab selected when its mounted terminal persists its initial layout',
  async (agent) => {
    const worktree = { ...makeWorktree(), hostId: 'local' as const }
    useAppStore.setState({ worktreesByRepo: { [worktree.repoId]: [worktree] } })
    const home = useAppStore.getState().createTab(worktree.id)
    openAgentHubMirror({
      worktree,
      repo: null,
      tab: home,
      paneKey: null,
      title: home.title,
      agentType: null
    })
    const windowId = readAgentHubMirrors().windows[0]?.id
    if (!windowId) {
      throw new Error('No mirror')
    }
    expect(await startAgentInAgentHubMirror(windowId, worktree, agent)).toBe(true)
    const mirror = readAgentHubMirrors().windows[0]
    const added = mirror?.tabs.find((tab) => tab.id === mirror.activeTabId)
    if (!added || !fixture.initialLayout) {
      throw new Error('No mounted terminal layout')
    }
    useAppStore.getState().setTabLayout(added.target.tab.id, fixture.initialLayout)
    pruneClosedAgentHubMirrorSources()
    expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
    expect(readAgentHubMirrors().windows[0]?.activeTabId).toBe(added.id)
    expect(readAgentHubMirrors().windows[0]?.tabs[1]?.target.paneKey).toBe(added.target.paneKey)
  }
)
