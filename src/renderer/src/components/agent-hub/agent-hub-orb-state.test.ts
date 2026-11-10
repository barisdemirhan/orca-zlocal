// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { EMPTY_STRUCTURED_AGENT_SESSION } from '../../../../shared/agent-session/structured-agent-session-reducer'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import { deriveAgentHubOrbState } from './agent-hub-orb-state'
import { orbApproval, orbAsk, orbMessage } from './agent-hub-orb-test-fixtures'

const mocks = vi.hoisted(() => ({ current: vi.fn(), listener: () => {}, read: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: { agentHubAgentControl: true },
      unifiedTabsByWorktree: {}
    }))
  }
})
vi.mock('@/runtime/native-chat/status/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => ({
    activate: () => () => {},
    subscribe: (fn: () => void) => {
      mocks.listener = fn
      return () => {}
    }
  })
}))
vi.mock('../native-chat/session/structured/read/use-structured-agent-session-read', () => ({
  useStructuredAgentSessionRead: mocks.read
}))
vi.mock('./agent-hub-orb-open', () => ({ openAgentHubOrb: vi.fn() }))
vi.mock('./agent-hub-dictation-origin', () => ({ useAgentHubDictationSession: () => null }))
import { useAgentHubOrb } from './agent-hub-orb-session'

const base = {
  sessionId: 'orb-session',
  items: [],
  working: false,
  listening: false,
  requests: [],
  now: 100_000
}
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
describe('Orb state', () => {
  it('needs an active session, then stays idle without activity', () => {
    expect(deriveAgentHubOrbState({ ...base, sessionId: null, working: true })).toEqual({
      kind: 'off'
    })
    expect(deriveAgentHubOrbState(base)).toEqual({ kind: 'idle' })
  })
  it('gives its own local ask priority and ignores other callers and hosts', () => {
    const item = { host: 'local', request: orbAsk() }
    expect(
      deriveAgentHubOrbState({ ...base, working: true, listening: true, requests: [item] })
    ).toMatchObject({ kind: 'needsYou', request: { kind: 'request', item } })
    expect(
      deriveAgentHubOrbState({
        ...base,
        requests: [
          { ...item, host: 'remote' },
          { host: 'local', request: orbAsk('other-session') }
        ]
      })
    ).toEqual({ kind: 'idle' })
  })
  it('shows a pending provider approval over work and releases it on resolution', () => {
    const approval = orbApproval()
    expect(deriveAgentHubOrbState({ ...base, items: [approval], working: true })).toMatchObject({
      kind: 'needsYou',
      request: { kind: 'prompt', item: approval }
    })
    expect(
      deriveAgentHubOrbState({
        ...base,
        items: [
          {
            ...approval,
            body: {
              ...approval.body,
              resolution: { ...approval.body.resolution, state: 'resolved' }
            }
          }
        ]
      })
    ).toEqual({ kind: 'idle' })
  })
  it('shows listening only when its known dictation target owns the mic', () => {
    expect(deriveAgentHubOrbState({ ...base, listening: true, working: true })).toEqual({
      kind: 'listening'
    })
    expect(deriveAgentHubOrbState({ ...base, working: true })).toEqual({ kind: 'working' })
  })
  it('uses the latest command and bounds its single-line preview', () => {
    const item: AgentJournalRenderItem = {
      itemId: 'tool',
      revision: 1,
      sequence: 2,
      observedAt: 100_000,
      body: {
        kind: 'tool-call',
        name: 'Bash',
        input: JSON.stringify({ command: `pnpm\n${'test '.repeat(30)}` }),
        state: 'running'
      }
    }
    const state = deriveAgentHubOrbState({ ...base, working: true, items: [item] })
    expect(state.kind).toBe('working')
    if (state.kind !== 'working') {
      throw new Error('Expected work state')
    }
    expect(state.command).toMatch(/^pnpm test/)
    expect(state.command).not.toMatch(/[\r\n]/)
    expect(state.command?.length).toBeLessThanOrEqual(80)
    expect(state.command).toMatch(/…$/)
  })
  it('keeps the final first line for six seconds after a long turn completes', () => {
    const reply = orbMessage('Tests passed\nDetails', 10_000)
    const latestTurn = {
      itemId: 'turn',
      observedAt: 1_000,
      turn: {
        kind: 'turn' as const,
        turnId: 'turn',
        state: 'completed' as const,
        outcome: 'success' as const,
        completedAt: 100_000
      }
    }
    expect(deriveAgentHubOrbState({ ...base, items: [reply], latestTurn, now: 105_999 })).toEqual({
      kind: 'done',
      summary: 'Tests passed',
      reply: 'Tests passed\nDetails',
      expiresAt: 106_000
    })
    expect(deriveAgentHubOrbState({ ...base, items: [reply], latestTurn, now: 106_000 })).toEqual({
      kind: 'idle'
    })
    expect(
      deriveAgentHubOrbState({
        ...base,
        items: [reply],
        latestTurn: { ...latestTurn, turn: { ...latestTurn.turn, outcome: 'failure' } }
      })
    ).toEqual({ kind: 'error' })
    expect(
      deriveAgentHubOrbState({
        ...base,
        items: [reply],
        latestTurn: { ...latestTurn, turn: { ...latestTurn.turn, outcome: undefined } }
      })
    ).toEqual({ kind: 'idle' })
  })
  it('does not announce an earlier reply while a new message awaits a response', () => {
    expect(
      deriveAgentHubOrbState({
        ...base,
        items: [orbMessage('Old reply', 99_000), orbMessage('New question', 99_500, 'user')]
      })
    ).toEqual({ kind: 'idle' })
    expect(
      deriveAgentHubOrbState({
        ...base,
        items: [orbMessage('Old reply', 99_000), orbMessage('New question', 99_000, 'user')]
      })
    ).toEqual({ kind: 'idle' })
    expect(
      deriveAgentHubOrbState({
        ...base,
        items: [{ ...orbMessage('Child result', 99_000), agentId: 'child' }]
      })
    ).toEqual({ kind: 'idle' })
  })
})

describe('Orb session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    mocks.current
      .mockReset()
      .mockResolvedValue({ sessionId: 'orb-session', tabId: 'orb-tab', resumed: false })
    mocks.read.mockReset().mockReturnValue({
      state: {
        ...EMPTY_STRUCTURED_AGENT_SESSION,
        status: 'ready',
        items: [orbMessage('Ready\nMore', 100_000)]
      }
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { agentHub: { orb: { current: mocks.current, open: vi.fn(), list: vi.fn() } } }
    })
  })
  it('expires done without another host event and reads without marking the chat viewed', async () => {
    const { result } = renderHook(() => useAgentHubOrb([]))
    await act(async () => {})
    expect(result.current.state.kind).toBe('done')
    expect(mocks.read).toHaveBeenLastCalledWith({
      sessionId: 'orb-session',
      target: { kind: 'local' },
      isVisible: true,
      isViewed: false
    })
    act(() => vi.advanceTimersByTime(6000))
    expect(result.current.state.kind).toBe('idle')
  })
  it('refreshes on host events and tab closure, and drops stale reads', async () => {
    const { result } = renderHook(() => useAgentHubOrb([]))
    await act(async () => {})
    let release: ((value: null) => void) | undefined
    mocks.current.mockImplementationOnce(
      () =>
        new Promise<null>((resolve) => {
          release = resolve
        })
    )
    act(() => mocks.listener())
    mocks.current.mockResolvedValue({ sessionId: 'new-orb', resumed: false })
    await act(async () => {
      useAppStore.setState({ unifiedTabsByWorktree: {} })
    })
    expect(result.current.session?.sessionId).toBe('new-orb')
    await act(async () => {
      release?.(null)
    })
    expect(result.current.session?.sessionId).toBe('new-orb')
    mocks.current.mockResolvedValue(null)
    await act(async () => {
      mocks.listener()
    })
    expect(result.current.state.kind).toBe('off')
  })
})
