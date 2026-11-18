/** @vitest-environment happy-dom */
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { AgentHubRequest, AgentHubResponse } from '../../../../shared/agent-hub-requests'
import { createGlobalSettingsFixture } from '../../../../shared/settings/global-settings-test-fixture'
import {
  makeRepo,
  makeWorktree,
  makeTabWithIds
} from '../activity/ActivityPrototypePage-test-fixtures'
import { AgentHubAlertStack } from './AgentHubAlertStack'
import { useAgentHubAlerts } from './use-agent-hub-alerts'
import { useAgentHubPreferences, type AgentHubPreferences } from './use-agent-hub-settings'
import { buildAgentHubLists } from './agent-hub-lists'
import {
  useAgentHubAlertQueue,
  pruneAgentHubRequestAlerts,
  dismissAgentHubAlert,
  clearAgentHubAlerts,
  readAgentHubAlertQueue
} from './agent-hub-alert-queue'
import {
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  readAgentHubRequests,
  agentHubRequestKey
} from './agent-hub-requests-store'
import {
  agentHubAskRequest,
  agentHubNotifyRequest,
  agentHubGateRequest
} from './agent-hub-request-test-fixtures'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'
import { playAgentHubAlertSound } from './agent-hub-chime'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'

vi.mock('./agent-hub-chime', () => ({ playAgentHubAlertSound: vi.fn() }))
vi.mock('@/attention/agent-attention-notification-delivery', () => ({
  isNativeAgentBannerRefused: () => false,
  readAgentAttentionNotificationSound: () => undefined
}))
vi.mock('@/attention/orca-window-foreground-focus', () => ({
  isOrcaWindowForegroundFocused: () => false
}))
vi.mock('../terminal-pane/notifications/terminal-attention-surface', () => ({
  createTerminalAttentionSurface: () => ({ isSurfaceViewed: () => false })
}))
const lists = buildAgentHubLists([])
const initial = useAppStore.getState()
const opened = vi.fn()
const respond = vi.fn<(host: string, id: string, response: AgentHubResponse) => Promise<void>>()
let unregister: () => void
let serial = 0
const id = (): string => `alert-${++serial}`
const presentation: AgentHubRequestPresentation = {
  title: 'Worker terminal',
  targetTitle: 'Target terminal',
  target: {
    repo: makeRepo(),
    worktree: makeWorktree(),
    tab: makeTabWithIds('tab-1', 'wt-1'),
    paneKey: null,
    title: 'Worker terminal',
    agentType: 'claude'
  },
  location: { group: null, project: 'Orca', workspace: 'feature', host: 'workhost' }
}
const NO_CHANGES: Partial<AgentHubPreferences> = {}
function Alerts({
  changes = NO_CHANGES
}: {
  changes?: Partial<AgentHubPreferences>
}): React.JSX.Element {
  const anchorRef = useRef<HTMLDivElement>(null)
  const preferences = useAgentHubPreferences()
  useAgentHubAlerts(lists, { ...preferences, ...changes })
  const alerts = useAgentHubAlertQueue()
  return (
    <TooltipProvider>
      <div ref={anchorRef} />
      <AgentHubAlertStack
        alerts={alerts}
        anchorRef={anchorRef}
        side="top"
        locationOf={() => presentation.location}
        requestPresentationOf={() => presentation}
        onOpen={opened}
        onJump={vi.fn()}
        onPopout={vi.fn()}
        onDismiss={dismissAgentHubAlert}
        answerKeys
      />
    </TooltipProvider>
  )
}
function receive(request: AgentHubRequest, host = 'workhost'): void {
  act(() => applyAgentHubDelivery(host, request))
}
beforeEach(() => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({
      experimentalAgentHub: true,
      agentHubAlertSound: true,
      agentHubAlertOnNeedsInput: true,
      agentHubAlertOnFinished: true
    }),
    repos: [{ ...makeRepo(), executionHostId: 'local' }],
    worktreesByRepo: { 'repo-1': [{ ...makeWorktree(), hostId: 'local' }] }
  })
  respond.mockReset().mockResolvedValue(undefined)
  opened.mockClear()
  vi.mocked(playAgentHubAlertSound).mockClear()
  unregister = registerAgentHubRequestResponder(respond)
})
afterEach(() => {
  cleanup()
  unregister()
  for (const host of readAgentHubRequests().keys()) {
    clearAgentHubRequestHost(host)
  }
  pruneAgentHubRequestAlerts(new Map())
  useAppStore.setState(initial)
  vi.useRealTimers()
})

it('opens the request card from its bubble and offers only four direct answers', async () => {
  const ask = agentHubAskRequest({
    requestId: id(),
    options: ['First', 'Second', 'Third', 'Fourth', 'Fifth']
  })
  render(<Alerts />)
  receive(ask)
  expect(screen.queryByRole('button', { name: '5 Fifth' })).toBeNull()
  fireEvent.click(screen.getByText('Which approach?'))
  expect(opened).toHaveBeenCalledWith(expect.objectContaining({ host: 'workhost', request: ask }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '2 Second' })))
  expect(respond).toHaveBeenCalledWith('workhost', ask.requestId, {
    kind: 'ask',
    answer: 'Second',
    index: 2
  })
  expect(screen.getByText('Sending…')).toBeTruthy()
  act(() => applyAgentHubDelivery('workhost', { ...ask, kind: 'closed', reason: 'responded' }))
  expect(screen.queryByText('Which approach?')).toBeNull()
})

it('does not take focus or number keys from a typing field or terminal', async () => {
  vi.useFakeTimers()
  const input = document.createElement('input')
  const terminal = document.createElement('textarea')
  terminal.className = 'xterm-helper-textarea'
  document.body.append(input, terminal)
  input.focus()
  render(<Alerts />)
  const ask = agentHubAskRequest({ requestId: id() })
  receive(ask)
  expect(document.activeElement).toBe(input)
  act(() => vi.advanceTimersByTime(401))
  fireEvent.keyDown(input, { key: '2' })
  terminal.focus()
  fireEvent.keyDown(terminal, { key: '2' })
  expect(respond).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(terminal)
  await act(async () => fireEvent.keyDown(document.body, { key: '2' }))
  expect(respond).toHaveBeenCalledWith('workhost', ask.requestId, {
    kind: 'ask',
    answer: 'Second',
    index: 2
  })
  input.remove()
  terminal.remove()
})

it.each(['info', 'done'] as const)(
  'uses the %s visual tone and acknowledges explicit dismissal',
  async (level) => {
    const notify = agentHubNotifyRequest({
      requestId: id(),
      level,
      links: ['https://example.com/one', 'https://example.org/two']
    })
    render(<Alerts />)
    receive(notify)
    expect(
      document.querySelector('[data-agent-hub-alert]')?.getAttribute('data-agent-hub-alert')
    ).toBe(level)
    expect(screen.getAllByRole('button', { name: /^Peek at / })).toHaveLength(2)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' })))
    expect(respond).toHaveBeenCalledWith('workhost', notify.requestId, { kind: 'ack' })
    act(() => applyAgentHubDelivery('workhost', { ...notify, kind: 'closed', reason: 'responded' }))
    expect(screen.queryByText('Deployment ready')).toBeNull()
  }
)

it.each([
  { changes: { alertSound: false }, sound: true, bubbles: 1, chimes: 0 },
  { changes: {}, sound: false, bubbles: 1, chimes: 0 },
  { changes: {}, sound: true, bubbles: 1, chimes: 1 },
  { changes: { alertsMutedUntil: Number.MAX_SAFE_INTEGER }, sound: true, bubbles: 0, chimes: 0 },
  { changes: { alertOnFinished: false }, sound: true, bubbles: 0, chimes: 0 }
])('respects sound, mute and finished preferences: %j', ({ changes, sound, bubbles, chimes }) => {
  render(<Alerts changes={changes} />)
  receive(agentHubNotifyRequest({ requestId: id(), level: 'done', sound }))
  expect(readAgentHubAlertQueue()).toHaveLength(bubbles)
  expect(playAgentHubAlertSound).toHaveBeenCalledTimes(chimes)
})

it('applies needs-input preferences to asks and consent while info remains visible', () => {
  render(<Alerts changes={{ alertOnNeedsInput: false }} />)
  receive(agentHubAskRequest({ requestId: id() }))
  receive({
    ...agentHubAskRequest({ requestId: id() }),
    kind: 'consent',
    operation: { kind: 'arrange' }
  })
  expect(readAgentHubAlertQueue()).toHaveLength(0)
  receive(agentHubNotifyRequest({ requestId: id(), level: 'info' }))
  expect(readAgentHubAlertQueue()).toHaveLength(1)
})

it('silences info independently while keeping questions and finished alerts enabled', () => {
  render(<Alerts changes={{ alertOnInfo: false }} />)
  receive(agentHubNotifyRequest({ requestId: id(), level: 'info', sound: true }))
  expect(readAgentHubAlertQueue()).toHaveLength(0)
  expect(playAgentHubAlertSound).not.toHaveBeenCalled()
  receive(agentHubAskRequest({ requestId: id() }))
  expect(readAgentHubAlertQueue()).toHaveLength(1)
  receive(agentHubNotifyRequest({ requestId: id(), level: 'done' }))
  expect(readAgentHubAlertQueue()[0]?.kind).toBe('done')
})

it('keeps a needs-you notice for the Inbox when its bubble is dismissed or times out', async () => {
  vi.useFakeTimers()
  const notify = agentHubNotifyRequest({ requestId: id(), level: 'needs-you' })
  render(<Alerts />)
  receive(notify)
  expect(
    document.querySelector('[data-agent-hub-alert]')?.getAttribute('data-agent-hub-alert')
  ).toBe('ask')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' })))
  receive(agentHubNotifyRequest({ requestId: id(), level: 'needs-you' }))
  await act(async () => vi.advanceTimersByTime(7000))
  clearAgentHubAlerts()
  expect(respond).not.toHaveBeenCalled()
  expect(readAgentHubRequests().get('workhost')?.notifications.size).toBe(2)
})

it('acks when a notification bubble times out and removes expired requests on host closed', async () => {
  vi.useFakeTimers()
  const notify = agentHubNotifyRequest({ requestId: id(), level: 'done', expiresAt: 600_000 })
  render(<Alerts />)
  receive(notify)
  await act(async () => vi.advanceTimersByTime(7000))
  expect(respond).toHaveBeenCalledWith('workhost', notify.requestId, { kind: 'ack' })
  act(() => applyAgentHubDelivery('workhost', { ...notify, kind: 'closed', reason: 'timeout' }))
  expect(screen.queryByText('Deployment ready')).toBeNull()
  expect(readAgentHubRequests().get('workhost')?.notifications.size).toBe(0)
})

it('replaces bubbles per pane but keeps equal request IDs and pane keys on different hosts independent', () => {
  render(<Alerts />)
  const first = agentHubAskRequest({ requestId: id() })
  receive(first, 'local')
  receive(first, 'workhost')
  expect(readAgentHubAlertQueue().map((alert) => alert.id)).toEqual([
    agentHubRequestKey('local', first.requestId),
    agentHubRequestKey('workhost', first.requestId)
  ])
  const second = agentHubAskRequest({ requestId: id(), question: 'New question' })
  receive(second, 'workhost')
  expect(readAgentHubAlertQueue().map((alert) => alert.id)).toEqual([
    agentHubRequestKey('local', first.requestId),
    agentHubRequestKey('workhost', second.requestId)
  ])
  act(() => applyAgentHubDelivery('local', { ...first, kind: 'closed', reason: 'timeout' }))
  expect(readAgentHubAlertQueue().map((alert) => alert.id)).toEqual([
    agentHubRequestKey('workhost', second.requestId)
  ])
})

it('shows the newest request per pane from a replayed snapshot and bounds the bubble stack', () => {
  render(<Alerts />)
  const oldNotice = agentHubNotifyRequest({ requestId: id(), createdAt: 1 })
  const newerAsk = agentHubAskRequest({ requestId: id(), createdAt: 20 })
  const others = Array.from({ length: 5 }, (_, index) =>
    agentHubAskRequest({
      requestId: id(),
      createdAt: 30 + index,
      caller: { ...newerAsk.caller, paneKey: `other-${index}` }
    })
  )
  act(() =>
    applyAgentHubDelivery('workhost', {
      kind: 'snapshot',
      snapshot: {
        requests: [newerAsk, oldNotice],
        progress: []
      }
    })
  )
  expect(readAgentHubAlertQueue().map((alert) => alert.id)).toEqual([
    agentHubRequestKey('workhost', newerAsk.requestId)
  ])
  act(() =>
    applyAgentHubDelivery('workhost', {
      kind: 'snapshot',
      snapshot: {
        requests: [oldNotice, newerAsk, ...others],
        progress: []
      }
    })
  )
  expect(readAgentHubAlertQueue().map((alert) => alert.id)).toEqual(
    others.map((ask) => agentHubRequestKey('workhost', ask.requestId))
  )
})

it('raises a decision gate bubble that answers its host and closes on the host event', async () => {
  const gate = agentHubGateRequest()
  render(<Alerts />)
  receive(gate, 'local')
  expect(screen.getByText('Decision gate')).toBeTruthy()
  expect(screen.getByText('Ship Orca · Choose strategy')).toBeTruthy()
  fireEvent.click(screen.getByText('Which approach?'))
  expect(opened).toHaveBeenCalledWith(expect.objectContaining({ host: 'local', request: gate }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '1 Small' })))
  expect(respond).toHaveBeenCalledWith('local', gate.gateId, {
    kind: 'ask',
    answer: 'Small (Recommended)',
    index: 1
  })
  expect(screen.getByText('Decision gate')).toBeTruthy()
  act(() =>
    applyAgentHubDelivery('local', {
      ...gate,
      kind: 'closed',
      gateId: gate.gateId,
      reason: 'responded'
    })
  )
  expect(screen.queryByText('Decision gate')).toBeNull()
})
