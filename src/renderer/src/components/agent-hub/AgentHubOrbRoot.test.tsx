// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EMPTY_STRUCTURED_AGENT_SESSION } from '../../../../shared/structured-agent-session-reducer'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubCounts } from './agent-hub-lists'
import { AgentHubRoot } from './AgentHubRoot'
import {
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  agentHubInboxRequests,
  readAgentHubRequests
} from './agent-hub-requests-store'
import { clearAgentHubAlerts, pushAgentHubAlerts } from './agent-hub-alert-queue'
import { orbAsk } from './agent-hub-orb-test-fixtures'
import { getAgentHubCommands } from './agent-hub-commands'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'

const mocks = vi.hoisted(() => ({ orb: vi.fn(), open: vi.fn(), threads: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { getDefaultSettings } = await import('../../../../shared/constants')
  return {
    useAppStore: create(() => ({
      settings: { ...getDefaultSettings('/test'), agentHubDockAutoHide: true },
      keybindings: {},
      projectGroups: [],
      activeView: 'terminal',
      acknowledgeAgents: vi.fn(),
      updateSettings: vi.fn()
    }))
  }
})
vi.mock('../activity/use-agent-pane-threads', () => ({
  useAgentPaneThreads: () => ({ allThreads: mocks.threads() })
}))
vi.mock('./agent-hub-orb-session', () => ({ useAgentHubOrb: mocks.orb }))
vi.mock('./use-agent-hub-alerts', () => ({ useAgentHubAlerts: () => {} }))
vi.mock('./use-agent-hub-session-restore', () => ({ useAgentHubSessionRestore: () => {} }))
vi.mock('./use-agent-hub-focused-pane-outline', () => ({ useAgentHubFocusedPaneOutline: () => {} }))
vi.mock('./use-agent-hub-host-labels', () => ({ useAgentHubHostLabels: () => undefined }))
vi.mock('./use-agent-hub-canvas-welcome', () => ({ useAgentHubCanvasWelcome: () => null }))
vi.mock('./use-agent-hub-canvas', () => ({ useAgentHubCanvas: () => false }))
vi.mock('./agent-hub-mirror-store', () => ({
  useAgentHubMirrors: () => ({ windows: [], chips: [] }),
  readAgentHubMirrors: () => ({ windows: [], chips: [] })
}))
vi.mock('./AgentHubPopover', () => ({ AgentHubPopoverContent: () => null }))
vi.mock('./AgentHubShortcutsDialog', () => ({ AgentHubShortcutsDialog: () => null }))
vi.mock('./AgentHubDimToggle', () => ({ AgentHubDimBackdrop: () => null }))
vi.mock('./AgentHubMirrorFocusShade', () => ({ AgentHubWorkspaceFocusShade: () => null }))
vi.mock('./AgentHubPeek', () => ({ AgentHubPeek: () => null }))
vi.mock('./AgentHubDictationPaneTag', () => ({ AgentHubDictationPaneTag: () => null }))
vi.mock('./AgentHubDock', () => ({
  AgentHubDock: ({ counts, orb }: { counts: AgentHubCounts; orb?: unknown }) => (
    <div data-testid="dock" data-waiting={counts.needsYou} data-orb={Boolean(orb)} />
  )
}))
vi.mock('./AgentHubMirrors', () => ({
  AgentHubMirrors: ({ trayHidden }: { trayHidden: boolean }) => (
    <div data-testid="tray" data-hidden={trayHidden} />
  )
}))
vi.mock('./AgentHubRootAlerts', () => ({
  AgentHubRootAlerts: ({ alerts }: { alerts: readonly AgentHubAlert[] }) => (
    <div data-testid="peek">
      {alerts[0]?.request?.kind === 'ask' ? alerts[0].request.question : ''}
    </div>
  )
}))
vi.mock('./AgentHubOrbPill', () => ({ AgentHubOrbPill: () => <div data-testid="orb-pill" /> }))

beforeEach(() => {
  clearAgentHubAlerts()
  clearAgentHubRequestHost('local')
  mocks.open.mockClear()
  mocks.threads.mockReturnValue([])
  mocks.orb.mockReturnValue({
    state: { kind: 'idle' },
    session: null,
    readState: EMPTY_STRUCTURED_AGENT_SESSION,
    openOrb: mocks.open
  })
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Expected settings')
  }
  useAppStore.setState({
    settings: {
      ...settings,
      agentHubPlacement: 'dock',
      agentHubOrbPlacement: 'dock',
      agentHubDockAutoHide: true,
      agentHubAlertsMutedUntil: Date.now() + 60_000
    }
  })
})
afterEach(() => {
  cleanup()
  clearAgentHubAlerts()
  clearAgentHubRequestHost('local')
})
const show = () =>
  render(
    <TooltipProvider>
      <AgentHubRoot iconOnly={false} />
    </TooltipProvider>
  )

it('returns the same queued peek after Orb releases its slot, even while alerts are muted', () => {
  const request = orbAsk('worker-session')
  request.caller.kind = 'orb'
  const queued = {
    id: 'queued-peek',
    host: 'local',
    request: {
      ...request,
      caller: { ...request.caller, kind: undefined },
      question: 'Existing worker question'
    },
    kind: 'ask'
  } as const
  pushAgentHubAlerts([queued])
  const { rerender } = show()
  expect(screen.getByTestId('peek').textContent).toBe('Existing worker question')
  mocks.orb.mockReturnValue({
    state: { kind: 'working' },
    session: { sessionId: 'orb-session' },
    readState: EMPTY_STRUCTURED_AGENT_SESSION,
    openOrb: mocks.open
  })
  rerender(
    <TooltipProvider>
      <AgentHubRoot iconOnly={false} />
    </TooltipProvider>
  )
  expect(screen.queryByTestId('peek')).toBeNull()
  expect(screen.getByTestId('orb-pill')).toBeTruthy()
  expect(screen.getByTestId('tray').dataset.hidden).toBe('true')
  mocks.orb.mockReturnValue({
    state: { kind: 'idle' },
    session: { sessionId: 'orb-session' },
    readState: EMPTY_STRUCTURED_AGENT_SESSION,
    openOrb: mocks.open
  })
  rerender(
    <TooltipProvider>
      <AgentHubRoot iconOnly={false} />
    </TooltipProvider>
  )
  expect(screen.getByTestId('peek').textContent).toBe('Existing worker question')
  expect(screen.getByTestId('tray').dataset.hidden).toBe('false')
})

it('keeps Orb asks in the Inbox without incrementing waiting and keeps its active pill visible with auto-hide', () => {
  const request = orbAsk()
  applyAgentHubDelivery('local', request)
  const [local] = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'waiting', at: 100_000 }])
  if (!local) {
    throw new Error('Expected local thread')
  }
  mocks.threads.mockReturnValue([
    local,
    { ...local, worktree: { ...local.worktree, hostId: 'ssh:other' }, paneKey: 'remote-pane' }
  ])
  mocks.orb.mockReturnValue({
    state: { kind: 'needsYou', request: { kind: 'request', item: { host: 'local', request } } },
    session: { sessionId: 'orb-session', tabId: local.tab.id },
    readState: EMPTY_STRUCTURED_AGENT_SESSION,
    openOrb: mocks.open
  })
  show()
  expect(screen.getByTestId('dock').dataset.waiting).toBe('1')
  expect(agentHubInboxRequests(readAgentHubRequests())).toHaveLength(1)
  expect(screen.getByTestId('orb-pill')).toBeTruthy()
})

it('falls back to the existing hub status item when an Orb dock has no hub dock', () => {
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Expected settings')
  }
  useAppStore.setState({
    settings: { ...settings, agentHubPlacement: 'status-bar', agentHubOrbPlacement: 'dock' }
  })
  show()
  expect(screen.getByRole('button', { name: 'Talk to Orb · Not set' })).toBeTruthy()
  expect(screen.queryByTestId('dock')).toBeNull()
})

it('shows status-bar Orb even with docked hub, and hidden placement still responds to its command', () => {
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Expected settings')
  }
  useAppStore.setState({
    settings: { ...settings, agentHubOrbPlacement: 'statusBar', agentHubDockAutoHide: false }
  })
  show()
  expect(screen.getByRole('button', { name: 'Talk to Orb · Not set' })).toBeTruthy()
  expect(screen.getByTestId('dock').dataset.orb).toBe('false')
  act(() =>
    useAppStore.setState({
      settings: { ...settings, agentHubOrbPlacement: 'hidden', agentHubDockAutoHide: false }
    })
  )
  expect(screen.queryByRole('button', { name: 'Talk to Orb · Not set' })).toBeNull()
  act(() => getAgentHubCommands()?.toggleOrb?.())
  expect(mocks.open).toHaveBeenCalledOnce()
})
