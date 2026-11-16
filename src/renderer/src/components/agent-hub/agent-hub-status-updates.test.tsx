/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../../../shared/agent-status/contracts/agent-status-freshness'
import {
  makeRepo,
  makeTab,
  makeWorktree,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import { useAgentPaneThreads } from '../activity/use-agent-pane-threads'
import { activityThreadStatusId } from '../activity/activity-thread-presentation'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { agentHubStateWord } from './agent-hub-copy'
import { useAppStore } from '@/store'
import { flushMicrotasks } from '@/store/slices/agent-status/agent-status-test-harness'
import { makeUnifiedTab } from '@/store/slices/tabs/tab-group.test-fixture'
import type { AgentStatusPayload } from '@/store/slices/agent-status/agent-status-contract'

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})

let fixtureClock = 100_000
beforeEach(() => {
  vi.useFakeTimers()
  fixtureClock += 60 * 60 * 1_000
  vi.setSystemTime(fixtureClock)
  vi.spyOn(useAppStore.getState(), 'refreshGitHubForWorktreeIfStale').mockImplementation(() => {})
  const repo = makeRepo()
  const worktree = makeWorktree()
  const tab = makeTab()
  useAppStore.setState({
    repos: [repo],
    worktreesByRepo: { [repo.id]: [worktree] },
    tabsByWorktree: { [worktree.id]: [tab] },
    unifiedTabsByWorktree: {
      [worktree.id]: [
        makeUnifiedTab({
          id: tab.id,
          entityId: tab.id,
          groupId: 'group-1',
          worktreeId: worktree.id,
          contentType: 'terminal'
        })
      ]
    },
    acknowledgedAgentsByPaneKey: {},
    activityClearedAtByPaneKey: {}
  })
})

afterEach(async () => {
  cleanup()
  useAppStore.getState().removeAgentStatus(PANE_KEY)
  await flushMicrotasks()
  vi.clearAllTimers()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function write(
  state: 'done' | 'working' | 'blocked' | 'waiting',
  overrides: Pick<AgentStatusPayload, 'restoredUnconfirmed' | 'mainAgent'> = {}
): void {
  useAppStore
    .getState()
    .setAgentStatus(
      PANE_KEY,
      { state, agentType: 'codex', prompt: 'Header status task', ...overrides },
      undefined,
      { updatedAt: Date.now(), evidenceObservedAt: Date.now() }
    )
}

function observe() {
  return renderHook(() => {
    const { allThreads } = useAgentPaneThreads({
      query: '',
      readFilter: 'all',
      groupBy: 'none',
      selectedPaneKey: null,
      showChildAgents: true
    })
    const thread = allThreads.find((entry) => entry.paneKey === PANE_KEY)
    return thread
      ? {
          kind: agentHubIndicatorKind(thread),
          status: activityThreadStatusId(thread),
          word: agentHubStateWord(thread)
        }
      : null
  })
}

it('updates the mirror reader through done, working, approval and done without a clock or focus change', () => {
  write('done')
  const hook = observe()
  expect(hook.result.current?.kind).toBe('done')
  for (const [state, kind] of [
    ['working', 'work'],
    ['blocked', 'ask'],
    ['working', 'work'],
    ['done', 'done']
  ] as const) {
    act(() => {
      vi.setSystemTime(Date.now() + 1_000)
      write(state)
    })
    expect(hook.result.current?.kind).toBe(kind)
  }
})

it.each(['blocked', 'waiting'] as const)(
  'keeps an unanswered %s turn asking after its evidence ages',
  async (state) => {
    write('done')
    act(() => {
      vi.setSystemTime(Date.now() + 1_000)
      write(state)
    })
    const hook = observe()
    await act(async () => {
      await flushMicrotasks()
      vi.advanceTimersByTime(AGENT_STATUS_STALE_AFTER_MS + 1)
    })
    expect(hook.result.current?.kind).toBe('ask')
    expect(hook.result.current?.status).toBe(state)
  }
)

it.each(['working'] as const)(
  'shows unknown instead of an old color when the current %s turn loses fresh evidence',
  async (state) => {
    write('done')
    act(() => {
      vi.setSystemTime(Date.now() + 1_000)
      write(state)
    })
    const hook = observe()
    expect(hook.result.current?.kind).toBe('work')
    const epoch = useAppStore.getState().agentStatusEpoch
    expect(useAppStore.getState().agentStatusByPaneKey.get(PANE_KEY)?.stateHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ state: 'done' })])
    )
    await act(async () => {
      await flushMicrotasks()
      vi.advanceTimersByTime(AGENT_STATUS_STALE_AFTER_MS + 1)
    })
    expect(useAppStore.getState().agentStatusByPaneKey.get(PANE_KEY)?.state).toBe(state)
    expect(useAppStore.getState().agentStatusEpoch).toBeGreaterThan(epoch)
    expect(hook.result.current).toEqual({
      kind: 'idle',
      status: 'unverifiable',
      word: 'No recent update'
    })
    act(() => write('working'))
    expect(hook.result.current?.kind).toBe('work')
    act(() => {
      vi.setSystemTime(Date.now() + 1_000)
      write('done')
    })
    expect(hook.result.current?.kind).toBe('done')
  }
)

it('keeps a restored unfinished turn unknown until fresh host evidence arrives', () => {
  write('done')
  vi.setSystemTime(Date.now() + 1_000)
  write('working', { restoredUnconfirmed: true })
  const hook = observe()
  expect(hook.result.current).toEqual({
    kind: 'idle',
    status: 'unverifiable',
    word: 'No recent update'
  })
  act(() => {
    vi.setSystemTime(Date.now() + 1_000)
    write('working', { restoredUnconfirmed: false })
  })
  expect(hook.result.current?.kind).toBe('work')
})

it('preserves a recorded main-agent failure when child-work evidence ages out', async () => {
  write('done')
  vi.setSystemTime(Date.now() + 1_000)
  write('working', { mainAgent: { state: 'done', outcome: 'failure', stateStartedAt: Date.now() } })
  const hook = observe()
  expect(hook.result.current?.status).toBe('failed')
  await act(async () => {
    await flushMicrotasks()
    vi.advanceTimersByTime(AGENT_STATUS_STALE_AFTER_MS + 1)
  })
  expect(hook.result.current?.status).toBe('failed')
})

it('keeps host-owned structured work live beyond the hook freshness window', async () => {
  write('done')
  vi.setSystemTime(Date.now() + 1_000)
  useAppStore
    .getState()
    .setAgentStatus(
      PANE_KEY,
      { state: 'working', agentType: 'codex', prompt: 'Host-owned turn' },
      undefined,
      { updatedAt: Date.now(), evidenceObservedAt: Date.now() },
      undefined,
      { structuredHostOwned: true }
    )
  const hook = observe()
  await act(async () => {
    await flushMicrotasks()
    vi.advanceTimersByTime(AGENT_STATUS_STALE_AFTER_MS + 1)
  })
  expect(hook.result.current?.kind).toBe('work')
})
