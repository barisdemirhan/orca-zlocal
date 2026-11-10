// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session/agent-session-wire'
import { useAgentHubOrbConversations } from './agent-hub-orb-conversations'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  snapshot: new Map<string, AgentSessionStatusSummary>(),
  listeners: new Set<() => void>()
}))

vi.mock('@/runtime/native-chat/status/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => ({
    activate: () => () => {},
    getSnapshot: () => mocks.snapshot,
    subscribe: (listener: () => void) => {
      mocks.listeners.add(listener)
      return () => mocks.listeners.delete(listener)
    }
  })
}))

function update(sessionId: string, updatedAt: number): void {
  mocks.snapshot = new Map(mocks.snapshot).set(sessionId, {
    sessionId,
    workspaceId: 'floating',
    agent: 'codex',
    status: 'idle',
    latestPrompt: '',
    updatedAt
  })
  act(() => mocks.listeners.forEach((listener) => listener()))
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.listeners.clear()
  mocks.snapshot = new Map()
  mocks.list
    .mockReset()
    .mockResolvedValue([
      { sessionId: 'past-orb', agent: 'codex', title: 'Past Orb', startedAt: 1, lastActiveAt: 1 }
    ])
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { agentHub: { orb: { list: mocks.list } } }
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('ignores unrelated structured sessions and coalesces changes to the current and past Orbs', async () => {
  renderHook(() => useAgentHubOrbConversations('current-orb', false))
  await act(async () => {})
  expect(mocks.list).toHaveBeenCalledOnce()
  update('worker-session', 1)
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(mocks.list).toHaveBeenCalledOnce()
  update('current-orb', 2)
  update('past-orb', 3)
  update('current-orb', 4)
  await act(async () => vi.advanceTimersByTimeAsync(249))
  expect(mocks.list).toHaveBeenCalledOnce()
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(mocks.list).toHaveBeenCalledTimes(2)
})

it('cancels a pending status refresh when the conversation reader unmounts', async () => {
  const { unmount } = renderHook(() => useAgentHubOrbConversations('current-orb', false))
  await act(async () => {})
  update('current-orb', 2)
  unmount()
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(mocks.list).toHaveBeenCalledOnce()
})
