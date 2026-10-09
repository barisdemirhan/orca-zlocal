/** @vitest-environment happy-dom */
import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { PANE_KEY, PANE_KEY_2 } from '../activity/ActivityPrototypePage-test-fixtures'
import { pushAgentHubAlerts } from './agent-hub-alert-queue'
import { buildAgentHubLists } from './agent-hub-lists'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import type { AgentHubPreferences } from './use-agent-hub-settings'
import { useAgentHubAlerts } from './use-agent-hub-alerts'

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ settings: undefined, activeWorktreeId: null }) }
}))
vi.mock('@/attention/agent-attention-notification-delivery', () => ({
  isNativeAgentBannerRefused: () => false,
  readAgentAttentionNotificationSound: () => undefined
}))
vi.mock('../terminal-pane/terminal-notification-pane-visibility', () => ({
  isOrcaWindowForegroundFocused: () => false
}))
vi.mock('../terminal-pane/terminal-attention-surface', () => ({
  createTerminalAttentionSurface: () => ({ isSurfaceViewed: () => false })
}))
vi.mock('./agent-hub-alert-queue', () => ({ pushAgentHubAlerts: vi.fn() }))
vi.mock('./agent-hub-chime', () => ({ playAgentHubAlertSound: vi.fn() }))
vi.mock('./agent-hub-mirror-store', () => ({ readAgentHubMirrors: () => ({ chips: [] }) }))

const preferences: AgentHubPreferences = {
  placement: 'dock',
  dockPosition: { edge: 'bottom', offset: 0 },
  dockSize: 'medium',
  dockAutoHide: false,
  alertOnNeedsInput: true,
  alertOnFinished: true,
  alertSound: false,
  focusedPaneOutline: true,
  alertsMutedUntil: null,
  showShells: false,
  finishedClearMinutes: 15,
  trayPeekSeconds: 5,
  mirrorWindowCap: 4,
  defaultTab: 'inbox',
  tabAutoPopout: false,
  canvas: false,
  restoreOnLaunch: false
}

const listsWith = (fixtures: Parameters<typeof agentHubThreadsFor>[0]) =>
  buildAgentHubLists(agentHubThreadsFor(fixtures))

beforeEach(() => {
  vi.mocked(pushAgentHubAlerts).mockClear()
})

it('does not raise an alert again when a result drops out of the lists and comes back', () => {
  const done = [{ paneKey: PANE_KEY, state: 'done' as const, at: 1_000 }]
  const { rerender } = renderHook(({ lists }) => useAgentHubAlerts(lists, preferences), {
    initialProps: { lists: listsWith([]) }
  })

  rerender({ lists: listsWith(done) })
  expect(pushAgentHubAlerts).toHaveBeenCalledTimes(1)

  // A shorter "Clear finished after" hides the result, then a longer one shows it again.
  rerender({ lists: listsWith([]) })
  rerender({ lists: listsWith(done) })
  expect(pushAgentHubAlerts).toHaveBeenCalledTimes(1)

  rerender({
    lists: listsWith([...done, { paneKey: PANE_KEY_2, state: 'done' as const, at: 2_000 }])
  })
  expect(pushAgentHubAlerts).toHaveBeenCalledTimes(2)
  expect(vi.mocked(pushAgentHubAlerts).mock.calls[1]?.[0]).toMatchObject([
    { thread: { paneKey: PANE_KEY_2 }, kind: 'done' }
  ])
})
