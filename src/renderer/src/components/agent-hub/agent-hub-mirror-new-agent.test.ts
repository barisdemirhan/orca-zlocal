/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  adoptAgentBackgroundSessionTab,
  reserveAgentBackgroundSessionIdentity
} from '@/lib/agent-session/launch/background/adopt-agent-background-session-tab'
import { buildAgentStartupPlan } from '../../../../shared/agent-launch/startup/tui-agent-startup'
import type { TerminalLayoutSnapshot } from '../../../../shared/workspace-layout/terminal-tab-types'
import { makePaneKey, parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { toWebTerminalSurfaceTabId } from '../../../../shared/workspace-layout/terminal-surface-id'
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
vi.mock('@/lib/agent-session/launch/background/launch-agent-background-session', () => ({
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
      worktreeId
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

it('tracks a runtime host agent under the mirrored tab id the host sync publishes', async () => {
  const worktree = { ...makeWorktree(), hostId: 'runtime:workhost' as const }
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
  const started = startAgentInAgentHubMirror(windowId, worktree, 'claude')
  await vi.waitFor(() => {
    if (!fixture.initialLayout) {
      throw new Error('Agent not launched')
    }
  })
  const reserved = (useAppStore.getState().tabsByWorktree[worktree.id] ?? []).find(
    (tab) => tab.id !== home.id
  )
  const leafId =
    reserved && useAppStore.getState().terminalLayoutsByTabId[reserved.id]?.activeLeafId
  if (!reserved || !leafId) {
    throw new Error('No reserved agent tab')
  }
  const mirroredId = toWebTerminalSurfaceTabId(reserved.id)
  // The host sync replaces the reserved tab with its mirrored surface.
  useAppStore.setState((state) => ({
    tabsByWorktree: {
      ...state.tabsByWorktree,
      [worktree.id]: [
        ...(state.tabsByWorktree[worktree.id] ?? []).filter((tab) => tab.id !== reserved.id),
        { ...reserved, id: mirroredId }
      ]
    },
    terminalLayoutsByTabId: {
      ...state.terminalLayoutsByTabId,
      [mirroredId]: { root: { type: 'leaf', leafId }, activeLeafId: leafId, expandedLeafId: null }
    }
  }))
  expect(await started).toBe(true)
  const mirror = readAgentHubMirrors().windows[0]
  const added = mirror?.tabs.find((tab) => tab.id === mirror.activeTabId)
  expect(added?.target.tab.id).toBe(mirroredId)
  expect(added?.target.paneKey).toBe(makePaneKey(mirroredId, leafId))
  expect(parsePaneKey(added?.target.paneKey ?? '')?.tabId).toBe(mirroredId)
})
