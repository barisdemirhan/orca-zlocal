/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type * as MirrorSource from './agent-hub-mirror-source'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { usePruneClosedAgentHubMirrorSources } from './use-prune-closed-agent-hub-mirror-sources'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/slices/store-test-helpers')
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
