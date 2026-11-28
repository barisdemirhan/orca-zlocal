// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/settings/global-settings-test-fixture'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import { useAgentHubOrb } from './agent-hub-orb-session'
import { openAgentHubOrb } from './agent-hub-orb-open'
import {
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'

const mocks = vi.hoisted(() => ({ current: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { createGlobalSettingsFixture } =
    await import('../../../../shared/settings/global-settings-test-fixture')
  return {
    useAppStore: create(() => ({
      settings: createGlobalSettingsFixture(),
      unifiedTabsByWorktree: {}
    }))
  }
})
vi.mock('@/lib/window-activity/use-now', () => ({ useNow: () => 0 }))
vi.mock('@/runtime/native-chat/status/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => ({
    activate: () => () => {},
    subscribe: () => () => {}
  })
}))
vi.mock('../native-chat/session/structured/read/use-structured-agent-session-read', () => ({
  useStructuredAgentSessionRead: () => ({ state: {} })
}))
vi.mock('../native-chat/session/structured/use-structured-agent-session-transport-state', () => ({
  useStructuredAgentSessionTransportState: () => ({
    journalItems: [],
    isWorking: false,
    queueSendsNext: false,
    latestTurn: null
  })
}))
vi.mock('./agent-hub-dictation-origin', () => ({ useAgentHubDictationSession: () => null }))
vi.mock('./agent-hub-requests-store', () => ({
  useAgentHubRequests: () => [],
  agentHubInboxRequests: () => []
}))
vi.mock('./agent-hub-orb-open', () => ({ openAgentHubOrb: vi.fn() }))

beforeEach(() => {
  vi.mocked(openAgentHubOrb).mockReset()
  mocks.current.mockReset().mockResolvedValue({ sessionId: 'current', resumed: false })
  closeAgentHubOrbPanel()
  useAgentHubOrbPanel.setState({ opening: false })
  useAppStore.setState({ settings: createGlobalSettingsFixture(), unifiedTabsByWorktree: {} })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { agentHub: { orb: { current: mocks.current } } }
  })
})

it('opens the configured alternate without changing the next normal action', async () => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({
      agentHubOrbAgent: 'codex',
      agentHubOrbDefaultAction: 'live',
      agentHubOrbAlternateAction: 'text'
    })
  })
  const { result } = renderHook(() => useAgentHubOrb([]))
  await act(async () => {
    await result.current.openOrb(true)
    await result.current.openOrb()
  })
  expect(openAgentHubOrb).toHaveBeenNthCalledWith(1, undefined, false, 'text')
  expect(openAgentHubOrb).toHaveBeenNthCalledWith(2, undefined, false, 'live')
  expect(useAppStore.getState().settings?.agentHubOrbDefaultAction).toBe('live')
})
afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
})

it.each([null, { sessionId: 'replacement', resumed: false }])(
  'releases a panel whose host session was closed or replaced',
  async (next) => {
    showAgentHubOrbPanel({ sessionId: 'current', resumed: false })
    renderHook(() => useAgentHubOrb([]))
    await waitFor(() => expect(mocks.current).toHaveBeenCalledOnce())
    mocks.current.mockResolvedValueOnce(next)
    act(() => useAppStore.setState({ unifiedTabsByWorktree: {} }))
    await waitFor(() => expect(useAgentHubOrbPanel.getState().session).toBeNull())
  }
)

it('releases the panel immediately when Agent control is disabled', async () => {
  showAgentHubOrbPanel({ sessionId: 'current', resumed: false })
  renderHook(() => useAgentHubOrb([]))
  await waitFor(() => expect(mocks.current).toHaveBeenCalledOnce())
  act(() =>
    useAppStore.setState({
      settings: createGlobalSettingsFixture({ agentHubAgentControl: false })
    })
  )
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
})

it('does not dismiss a newer panel when an older current read finishes late', async () => {
  let finish: ((session: AgentHubOrbSession | null) => void) | undefined
  mocks.current.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  showAgentHubOrbPanel({ sessionId: 'current', resumed: false })
  renderHook(() => useAgentHubOrb([]))
  act(() => showAgentHubOrbPanel({ sessionId: 'newer', resumed: false }))
  await act(async () => finish?.(null))
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('newer')
})

it('keeps the panel through the temporary tab gap of a settings reopen', async () => {
  showAgentHubOrbPanel({ sessionId: 'current', resumed: false })
  renderHook(() => useAgentHubOrb([]))
  await waitFor(() => expect(mocks.current).toHaveBeenCalledOnce())
  act(() => useAgentHubOrbPanel.setState({ opening: true }))
  mocks.current.mockResolvedValueOnce(null)
  act(() => useAppStore.setState({ unifiedTabsByWorktree: {} }))
  await act(async () => {})
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  mocks.current.mockReset().mockResolvedValue({ sessionId: 'replacement', resumed: false })
  act(() => {
    showAgentHubOrbPanel({ sessionId: 'replacement', resumed: false })
    useAgentHubOrbPanel.setState({ opening: false })
  })
  await waitFor(() => expect(mocks.current).toHaveBeenCalledOnce())
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('replacement')
})
