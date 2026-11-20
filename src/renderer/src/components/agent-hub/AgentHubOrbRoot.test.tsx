// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EMPTY_STRUCTURED_AGENT_SESSION } from '../../../../shared/agent-session/view/live-read/structured-agent-session-reducer'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubCounts } from './agent-hub-lists'
import { AgentHubRoot } from './AgentHubRoot'
import { AgentHubOrbButton } from './AgentHubOrbButton'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import {
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  agentHubInboxRequests,
  readAgentHubRequests
} from './agent-hub-requests-store'
import { clearAgentHubAlerts, pushAgentHubAlerts } from './agent-hub-alert-queue'
import { orbAsk } from './agent-hub-orb-test-fixtures'
import {
  agentHubGateRequest,
  agentHubNotifyRequest,
  agentHubRequestBase
} from './agent-hub-request-test-fixtures'
import { getAgentHubCommands } from './agent-hub-commands'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { PANE_KEY } from './agent-hub-activity-test-fixtures'
import {
  showAgentHubOrbPanel,
  closeAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'

const mocks = vi.hoisted(() => ({ orb: vi.fn(), open: vi.fn(), threads: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { getDefaultSettings } = await import('../../../../shared/orca-profiles/constants')
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
vi.mock('../activity/threads/use-agent-pane-threads', () => ({
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
vi.mock('./AgentHubPopover', async () => {
  const { PopoverContent } = await import('@/components/ui/popover')
  return { AgentHubPopoverContent: () => <PopoverContent data-testid="hub-panel" /> }
})
vi.mock('./AgentHubOrbPanel', () => ({ AgentHubOrbPanel: () => null }))
vi.mock('./agent-hub-orb-composer', () => ({ activateAgentHubOrb: mocks.open }))
vi.mock('./AgentHubShortcutsDialog', () => ({ AgentHubShortcutsDialog: () => null }))
vi.mock('./AgentHubDimToggle', () => ({ AgentHubDimBackdrop: () => null }))
vi.mock('./AgentHubMirrorFocusShade', () => ({ AgentHubWorkspaceFocusShade: () => null }))
vi.mock('./AgentHubPeek', () => ({ AgentHubPeek: () => null }))
vi.mock('./AgentHubAnswerQueue', () => ({ AgentHubAnswerQueue: () => null }))
vi.mock('./AgentHubDictationPaneTag', () => ({ AgentHubDictationPaneTag: () => null }))
vi.mock('./AgentHubDock', () => ({
  AgentHubDock: ({
    counts,
    orb
  }: {
    counts: AgentHubCounts
    orb?: Omit<Parameters<typeof AgentHubOrbButton>[0], 'side'> | null
  }) => (
    <div data-testid="dock" data-waiting={counts.needsYou} data-orb={Boolean(orb)}>
      {orb ? <AgentHubOrbButton {...orb} side="top" /> : null}
    </div>
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
  closeAgentHubOrbPanel()
  clearAgentHubAlerts()
  clearAgentHubRequestHost('local')
  mocks.open.mockReset()
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
    dictationState: 'idle',
    keybindings: { 'agentHub.toggleOrb': [] },
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
  closeAgentHubOrbPanel()
  clearAgentHubAlerts()
  clearAgentHubRequestHost('local')
})
const show = () =>
  render(
    <TooltipProvider>
      <AgentHubRoot iconOnly={false} />
    </TooltipProvider>
  )

it.each(['dock', 'statusBar', 'floating'] as const)(
  'toggles the %s Orb panel without stopping another pane recording',
  (placement) => {
    const settings = useAppStore.getState().settings
    if (!settings) {
      throw new Error('Expected settings')
    }
    const control = vi.fn()
    document.addEventListener(DICTATION_CONTROL_EVENT, control)
    try {
      useAppStore.setState({
        settings: {
          ...settings,
          agentHubOrbPlacement: placement,
          agentHubDockAutoHide: false
        },
        dictationState: 'listening'
      })
      mocks.open.mockImplementationOnce(() =>
        showAgentHubOrbPanel({ sessionId: 'orb-session', tabId: 'orb-tab', resumed: false })
      )
      show()
      const button = screen.getByRole('button', { name: 'Talk to Orb · Not set' })
      fireEvent.click(button)
      expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('orb-session')
      fireEvent.click(button)
      expect(useAgentHubOrbPanel.getState().session).toBeNull()
      expect(mocks.open).toHaveBeenCalledOnce()
      expect(control).not.toHaveBeenCalled()
      expect(useAppStore.getState().dictationState).toBe('listening')
    } finally {
      document.removeEventListener(DICTATION_CONTROL_EVENT, control)
    }
  }
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
    state: { kind: 'listening' },
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

it('exchanges the Hub and Orb panels and hides the Orb pill while its panel is open', () => {
  mocks.orb.mockReturnValue({
    state: { kind: 'working' },
    session: { sessionId: 'orb-session' },
    readState: EMPTY_STRUCTURED_AGENT_SESSION,
    openOrb: mocks.open
  })
  show()
  act(() => getAgentHubCommands()?.toggle())
  expect(screen.getByTestId('hub-panel')).toBeTruthy()
  act(() => showAgentHubOrbPanel({ sessionId: 'orb-session', tabId: 'orb-tab', resumed: false }))
  expect(screen.queryByTestId('hub-panel')).toBeNull()
  expect(screen.queryByTestId('orb-pill')).toBeNull()
  act(() => getAgentHubCommands()?.toggle())
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  expect(screen.getByTestId('hub-panel')).toBeTruthy()
})

it.each(['ask', 'consent', 'gate', 'notify'] as const)(
  'gives the visible Orb the current %s and returns its card and count to Hub when hidden',
  (kind) => {
    const ask = orbAsk()
    const request =
      kind === 'ask'
        ? ask
        : kind === 'gate'
          ? { ...agentHubGateRequest(), caller: ask.caller }
          : kind === 'notify'
            ? agentHubNotifyRequest({ caller: ask.caller, level: 'needs-you' })
            : {
                ...agentHubRequestBase(),
                caller: ask.caller,
                kind: 'consent' as const,
                operation: { kind: 'mirror' as const, action: 'close' as const }
              }
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
      state:
        kind === 'ask'
          ? {
              kind: 'needsYou',
              request: { kind: 'request', item: { host: 'local', request: ask } }
            }
          : { kind: 'working' },
      session: { sessionId: 'orb-session', tabId: local.tab.id },
      readState: EMPTY_STRUCTURED_AGENT_SESSION,
      openOrb: mocks.open
    })
    show()
    expect(screen.getByTestId('dock').dataset.waiting).toBe('2')
    expect(screen.queryByTestId('orb-pill')).toBeNull()
    act(() =>
      showAgentHubOrbPanel({ sessionId: 'orb-session', tabId: local.tab.id, resumed: false })
    )
    expect(screen.getByTestId('dock').dataset.waiting).toBe('1')
    expect(agentHubInboxRequests(readAgentHubRequests())).toHaveLength(1)
    act(() => useAgentHubOrbPanel.setState({ chatVisible: false }))
    expect(screen.getByTestId('dock').dataset.waiting).toBe('2')
    act(() => closeAgentHubOrbPanel())
    expect(screen.getByTestId('dock').dataset.waiting).toBe('2')
    expect(screen.queryByTestId('orb-pill')).toBeNull()
  }
)

it('uses the visible panel session while the background current-session read is still stale', () => {
  applyAgentHubDelivery('local', orbAsk('current'))
  mocks.orb.mockReturnValue({
    state: { kind: 'idle' },
    session: { sessionId: 'previous' },
    readState: EMPTY_STRUCTURED_AGENT_SESSION,
    openOrb: mocks.open
  })
  show()
  expect(screen.getByTestId('dock').dataset.waiting).toBe('1')
  act(() => showAgentHubOrbPanel({ sessionId: 'current', resumed: false }))
  expect(screen.getByTestId('dock').dataset.waiting).toBe('0')
  act(() => closeAgentHubOrbPanel())
  expect(screen.getByTestId('dock').dataset.waiting).toBe('1')
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

it.each(['floating', undefined] as const)(
  'shows a keyboard-accessible floating Orb for placement %s',
  async (placement) => {
    const settings = useAppStore.getState().settings
    if (!settings) {
      throw new Error('Expected settings')
    }
    useAppStore.setState({ settings: { ...settings, agentHubOrbPlacement: placement } })
    show()
    const button = screen.getByRole('button', { name: 'Talk to Orb · Not set' })
    expect(button.closest('[data-agent-hub-orb-floating]')).not.toBeNull()
    expect(screen.queryByTestId('dock')).toBeNull()
    act(() => button.focus())
    await userEvent.setup().keyboard('{Enter}')
    expect(mocks.open).toHaveBeenCalledOnce()
  }
)

it('moves the floating Orb without opening it, cancels a drag, and keeps it inside a resized window', () => {
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Expected settings')
  }
  const update = useAppStore.getState().updateSettings
  vi.mocked(update).mockClear()
  useAppStore.setState({
    settings: {
      ...settings,
      agentHubOrbPlacement: 'floating',
      agentHubOrbPosition: { x: 100, y: 100 }
    }
  })
  show()
  const button = screen.getByRole('button', { name: 'Talk to Orb · Not set' })
  const sphere = button.closest<HTMLElement>('[data-agent-hub-orb-floating]')
  if (!sphere) {
    throw new Error('Expected floating Orb')
  }
  sphere.setPointerCapture = vi.fn()
  sphere.hasPointerCapture = () => true
  sphere.releasePointerCapture = vi.fn()
  fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 110, clientY: 110 })
  fireEvent.pointerMove(sphere, { buttons: 1, pointerId: 1, clientX: 210, clientY: 210 })
  fireEvent.pointerUp(sphere, { pointerId: 1 })
  fireEvent.click(button, { detail: 1 })
  expect(mocks.open).not.toHaveBeenCalled()
  expect(update).toHaveBeenLastCalledWith({ agentHubOrbPosition: { x: 200, y: 200 } })
  expect(sphere.style.left).toBe('200px')
  fireEvent.pointerDown(button, { button: 0, pointerId: 2, clientX: 210, clientY: 210 })
  fireEvent.pointerMove(sphere, { buttons: 1, pointerId: 2, clientX: 310, clientY: 310 })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(sphere.style.left).toBe('200px')
  expect(update).toHaveBeenCalledOnce()
  fireEvent.pointerDown(button, { button: 0, pointerId: 3, clientX: 210, clientY: 210 })
  fireEvent.pointerMove(sphere, { buttons: 1, pointerId: 3, clientX: 310, clientY: 310 })
  fireEvent.pointerCancel(sphere, { pointerId: 3 })
  expect(sphere.style.left).toBe('200px')
  expect(update).toHaveBeenCalledOnce()
  const width = window.innerWidth
  const height = window.innerHeight
  try {
    window.innerWidth = 180
    window.innerHeight = 180
    fireEvent(window, new Event('resize'))
    expect(Number.parseFloat(sphere.style.left)).toBeLessThanOrEqual(132)
    expect(Number.parseFloat(sphere.style.top)).toBeLessThanOrEqual(108)
  } finally {
    window.innerWidth = width
    window.innerHeight = height
    fireEvent(window, new Event('resize'))
  }
})
