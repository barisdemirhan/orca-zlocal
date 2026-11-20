/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type * as MirrorSource from './agent-hub-mirror-source'
import { PANE_KEY, makeTabWithIds, makeWorktree } from './agent-hub-activity-test-fixtures'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { paneTargetFromThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { toggleAgentHubMirrorViewing } from './agent-hub-mirror-viewing'
import { usePruneClosedAgentHubMirrorSources } from './use-prune-closed-agent-hub-mirror-sources'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))

const worktree = makeWorktree()
const target: AgentHubPaneTarget = {
  worktree,
  repo: null,
  tab: makeTabWithIds('tab-a', worktree.id),
  paneKey: null,
  title: 'a',
  agentType: 'claude'
}

beforeEach(() => {
  resetAgentHubMirrorsForTest()
  useAppStore.setState({
    workspaceSessionReady: false,
    hydrationSucceeded: false,
    terminalStartupRestorationReady: false,
    tabsByWorktree: {}
  })
  openAgentHubMirror(target)
})

afterEach(() => {
  resetAgentHubMirrorsForTest()
})

it('closes the mirror of a tab closed after the session loaded, not before', () => {
  renderHook(() => usePruneClosedAgentHubMirrorSources())
  act(() => useAppStore.setState({ tabsByWorktree: { [worktree.id]: [] } }))
  expect(readAgentHubMirrors().windows).toHaveLength(1)

  act(() =>
    useAppStore.setState({
      workspaceSessionReady: true,
      hydrationSucceeded: true,
      terminalStartupRestorationReady: true,
      tabsByWorktree: { [worktree.id]: [target.tab] }
    })
  )
  expect(readAgentHubMirrors().windows).toHaveLength(1)

  act(() => useAppStore.setState({ tabsByWorktree: { [worktree.id]: [] } }))
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})

const leafA = '11111111-1111-4111-8111-111111111111'
const leafB = '22222222-2222-4222-8222-222222222222'
const splitRoot = {
  type: 'split' as const,
  direction: 'vertical' as const,
  first: { type: 'leaf' as const, leafId: leafA },
  second: { type: 'leaf' as const, leafId: leafB }
}

it('closes an agent mirror once its split leaf is closed', () => {
  resetAgentHubMirrorsForTest()
  const agent = { ...target, paneKey: makePaneKey(target.tab.id, leafB) }
  act(() =>
    useAppStore.setState({
      workspaceSessionReady: true,
      hydrationSucceeded: true,
      terminalStartupRestorationReady: true,
      tabsByWorktree: { [worktree.id]: [target.tab] },
      terminalLayoutsByTabId: {
        [target.tab.id]: { root: splitRoot, activeLeafId: leafB, expandedLeafId: null }
      }
    })
  )
  openAgentHubMirror(agent)
  renderHook(() => usePruneClosedAgentHubMirrorSources())
  expect(readAgentHubMirrors().windows).toHaveLength(1)

  act(() =>
    useAppStore.setState({
      terminalLayoutsByTabId: {
        [target.tab.id]: {
          root: { type: 'leaf', leafId: leafA },
          activeLeafId: leafA,
          expandedLeafId: null,
          ptyIdsByLeafId: { [leafA]: 'pty-a' }
        }
      }
    })
  )
  expect(readAgentHubMirrors().windows).toHaveLength(0)
})

it('keeps an agent mirror while its tab layout is unknown', () => {
  resetAgentHubMirrorsForTest()
  const agent = { ...target, paneKey: makePaneKey(target.tab.id, leafB) }
  act(() =>
    useAppStore.setState({
      workspaceSessionReady: true,
      hydrationSucceeded: true,
      terminalStartupRestorationReady: true,
      tabsByWorktree: { [worktree.id]: [target.tab] },
      terminalLayoutsByTabId: {}
    })
  )
  openAgentHubMirror(agent)
  renderHook(() => usePruneClosedAgentHubMirrorSources())
  act(() => useAppStore.setState({ tabsByWorktree: { [worktree.id]: [target.tab] } }))
  expect(readAgentHubMirrors().windows).toHaveLength(1)
})

it('returns to the home pane when the viewed split closes through a live layout update', () => {
  const home = { ...target, paneKey: makePaneKey(target.tab.id, leafA) }
  resetAgentHubMirrorsForTest()
  useAppStore.setState({
    workspaceSessionReady: true,
    hydrationSucceeded: true,
    terminalStartupRestorationReady: true,
    tabsByWorktree: { [worktree.id]: [target.tab] },
    terminalLayoutsByTabId: {
      [target.tab.id]: { root: splitRoot, activeLeafId: leafA, expandedLeafId: null }
    }
  })
  openAgentHubMirror(home)
  const window = readAgentHubMirrors().windows[0]
  if (!window) {
    throw new Error('No home window')
  }
  toggleAgentHubMirrorViewing(window.id, window.activeTabId, {
    ...home,
    paneKey: makePaneKey(target.tab.id, leafB)
  })
  renderHook(() => usePruneClosedAgentHubMirrorSources())
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeTruthy()
  act(() =>
    useAppStore.setState({
      terminalLayoutsByTabId: {
        [target.tab.id]: {
          root: { type: 'leaf', leafId: leafA },
          activeLeafId: leafA,
          expandedLeafId: null
        }
      }
    })
  )
  expect(readAgentHubMirrors().windows[0]?.id).toBe(window.id)
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.paneKey).toBe(home.paneKey)
})

it('returns to home when its viewed thread disappears from the live thread list', () => {
  const worker = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1_000 }])[0]
  const window = readAgentHubMirrors().windows[0]
  if (!worker || !window) {
    throw new Error('Missing source')
  }
  toggleAgentHubMirrorViewing(window.id, window.activeTabId, paneTargetFromThread(worker, 'Worker'))
  const hook = renderHook(({ threads }) => usePruneClosedAgentHubMirrorSources(threads), {
    initialProps: { threads: [worker] }
  })
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeTruthy()
  hook.rerender({ threads: [] })
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.title).toBe('a')
})
