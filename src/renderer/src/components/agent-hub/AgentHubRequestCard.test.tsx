/** @vitest-environment happy-dom */
import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { PANE_KEY } from './agent-hub-activity-test-fixtures'
import { createGlobalSettingsFixture } from '../../../../shared/settings/global-settings-test-fixture'
import type { AgentHubRequest, AgentHubResponse } from '../../../../shared/agent-hub-requests'
import { AgentHubInboxBody } from './AgentHubPanelSections'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import { agentHubInboxCards } from './agent-hub-inbox-cards'
import { buildAgentHubLists, agentHubCounts } from './agent-hub-lists'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'
import {
  agentHubInboxRequests,
  applyAgentHubDelivery,
  clearAgentHubRequestHost,
  readAgentHubRequests,
  useAgentHubRequests
} from './agent-hub-requests-store'
import {
  agentHubAskRequest,
  agentHubNotifyRequest,
  agentHubGateRequest
} from './agent-hub-request-test-fixtures'
import {
  agentHubRequestPresentation,
  type AgentHubRequestPresentation
} from './agent-hub-request-presentation'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
vi.mock('sonner', () => ({ toast: vi.fn() }))

const presentation: AgentHubRequestPresentation = {
  title: 'Worker terminal',
  targetTitle: 'Target terminal',
  target: null,
  location: { group: null, project: 'Orca', workspace: 'feature', host: 'workhost' }
}
const initial = useAppStore.getState()
const respond = vi.fn<(host: string, id: string, result: AgentHubResponse) => Promise<void>>()
let unregister: () => void
const cardControl = createRef<AgentHubCardControl>()
const defaultRequestPresentation = () => presentation
function Inbox({
  requestPresentationOf = defaultRequestPresentation
}: {
  requestPresentationOf?: Parameters<typeof AgentHubInboxBody>[0]['requestPresentationOf']
} = {}): React.JSX.Element {
  const requests = useAgentHubRequests()
  const items = agentHubInboxRequests(requests)
  const lists = buildAgentHubLists([])
  return (
    <TooltipProvider>
      <AgentHubInboxBody
        lists={lists}
        cards={agentHubInboxCards([], items)}
        hiddenCards={0}
        onShowHidden={vi.fn()}
        cardIndex={0}
        onPage={vi.fn()}
        now={0}
        popoutKeys={[]}
        cardControlRef={cardControl}
        requestPresentationOf={requestPresentationOf}
        actions={{
          locationOf: () => presentation.location,
          isSelected: () => false,
          onOpen: vi.fn(),
          onJump: vi.fn(),
          onPopout: vi.fn()
        }}
        onMarkRead={vi.fn()}
      />
    </TooltipProvider>
  )
}
function receive(request: AgentHubRequest): void {
  act(() => applyAgentHubDelivery('workhost', request))
}
function close(request: AgentHubRequest): void {
  act(() => applyAgentHubDelivery('workhost', { ...request, kind: 'closed', reason: 'responded' }))
}
beforeEach(() => {
  useAppStore.setState({ settings: createGlobalSettingsFixture({ experimentalAgentHub: true }) })
  respond.mockReset().mockResolvedValue(undefined)
  vi.mocked(toast).mockClear()
  unregister = registerAgentHubRequestResponder(respond)
})
afterEach(() => {
  cleanup()
  unregister()
  for (const host of readAgentHubRequests().keys()) {
    clearAgentHubRequestHost(host)
  }
  useAppStore.setState(initial)
  vi.useRealTimers()
})

it('shows provenance, recommendation and location, sends once to its host and waits for closed', async () => {
  const ask = agentHubAskRequest()
  let complete: (() => void) | undefined
  respond.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve
      })
  )
  const typing = document.createElement('input')
  document.body.appendChild(typing)
  typing.focus()
  render(<Inbox />)
  receive(ask)
  expect(document.activeElement).toBe(typing)
  expect(screen.getByText('@claude asks')).toBeTruthy()
  expect(screen.getByText('Worker terminal')).toBeTruthy()
  expect(screen.getByText('workhost')).toBeTruthy()
  expect(screen.getByText('Recommended')).toBeTruthy()
  const option = screen.getByRole('button', { name: '2 Second Recommended' })
  fireEvent.click(option)
  fireEvent.click(option)
  expect(respond).toHaveBeenCalledExactlyOnceWith('workhost', ask.requestId, {
    kind: 'ask',
    answer: 'Second',
    index: 2
  })
  expect(screen.getByText('Sending…')).toBeTruthy()
  await act(async () => complete?.())
  expect(screen.getByText('Which approach?')).toBeTruthy()
  close(ask)
  expect(screen.queryByText('Which approach?')).toBeNull()
  typing.remove()
})

it('shows the agent a request is about and both locations, with the host once', () => {
  receive(agentHubAskRequest())
  const { container } = render(
    <Inbox
      requestPresentationOf={() => ({
        ...presentation,
        related: {
          title: 'Review terminal',
          agentType: 'claude',
          location: { group: null, project: 'Other', workspace: 'main', host: 'workhost' }
        }
      })}
    />
  )
  expect(screen.getByText('Regarding @claude')).toBeTruthy()
  expect(screen.getByText('Review terminal')).toBeTruthy()
  const text = container.textContent ?? ''
  expect(text).toContain('Orca')
  expect(text).toContain('feature')
  expect(text).toContain('Other')
  expect(text).toContain('main')
  expect(text.match(/workhost/g)).toHaveLength(1)
})

it('toggles accessible multiple choices and sends sorted one-based indices only on Send', async () => {
  const ask = agentHubAskRequest({ multi: true })
  receive(ask)
  render(<Inbox />)
  expect(screen.getByRole('group', { name: ask.question })).toBeTruthy()
  const first = screen.getByRole('checkbox', { name: '1 First' })
  const second = screen.getByRole('checkbox', { name: '2 Second Recommended' })
  fireEvent.click(second)
  fireEvent.click(first)
  fireEvent.click(first)
  expect(first.getAttribute('aria-checked')).toBe('false')
  fireEvent.click(first)
  expect(second.getAttribute('aria-checked')).toBe('true')
  expect(respond).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Send' })[0]))
  expect(respond).toHaveBeenCalledWith('workhost', ask.requestId, {
    kind: 'ask',
    answer: 'First, Second',
    index: null,
    indices: [1, 2]
  })
})

it.each([false, true])('accepts free text with multi=%s and no option index', async (multi) => {
  const ask = agentHubAskRequest({ multi })
  receive(ask)
  render(<Inbox />)
  const input = screen.getByRole('textbox', { name: 'Reply to @claude…' })
  fireEvent.change(input, { target: { value: '  A different approach  ' } })
  const form = input.closest('form')
  if (!form) {
    throw new Error('reply form missing')
  }
  await act(async () => fireEvent.submit(form))
  expect(respond).toHaveBeenCalledWith('workhost', ask.requestId, {
    kind: 'ask',
    answer: 'A different approach',
    index: null
  })
})

it('briefly shows Answered elsewhere for a losing answer then removes it without a closed event', async () => {
  vi.useFakeTimers()
  const ask = agentHubAskRequest()
  respond.mockRejectedValue(Object.assign(new Error('resolved'), { code: 'already_resolved' }))
  receive(ask)
  render(<Inbox />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '1 First' })))
  expect(screen.getByText('Answered elsewhere')).toBeTruthy()
  act(() => vi.advanceTimersByTime(1500))
  expect(screen.queryByText('Which approach?')).toBeNull()
})

it('keeps a failed answer retryable and shows a late already_resolved without resurrecting the closed card', async () => {
  const ask = agentHubAskRequest()
  respond.mockRejectedValueOnce(new Error('network'))
  receive(ask)
  render(<Inbox />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '1 First' })))
  expect(screen.getByText('Could not send your answer. Try again.')).toBeTruthy()
  let fail: ((error: Error) => void) | undefined
  respond.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject
      })
  )
  fireEvent.click(screen.getByRole('button', { name: '1 First' }))
  close(ask)
  await act(async () => fail?.(Object.assign(new Error('late'), { code: 'already_resolved' })))
  expect(screen.queryByText('Which approach?')).toBeNull()
  expect(readAgentHubRequests().get('workhost')?.answerStates.size).toBe(0)
  expect(toast).toHaveBeenCalledWith('Answered elsewhere', { duration: 1500 })
})

it.each([
  ['once', 'Allow once'],
  ['session', 'Allow for this session'],
  ['deny', 'Deny']
] as const)(
  'sends consent decision %s with plain action and target title',
  async (decision, label) => {
    const ask = agentHubAskRequest()
    const consent: Extract<AgentHubRequest, { kind: 'consent' }> = {
      ...ask,
      kind: 'consent',
      operation: { kind: 'mirror', action: 'close' }
    }
    receive(consent)
    render(<Inbox />)
    expect(screen.getByText('@claude wants to close the mirror of Target terminal')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: label })))
    expect(respond).toHaveBeenCalledWith('workhost', consent.requestId, {
      kind: 'consent',
      decision
    })
    close(consent)
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  }
)

it.each(['local', 'workhost'])(
  'identifies a pane-less Orb once and keeps its consent tied to host %s',
  async (host) => {
    const target = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1 }])[0]
    target.paneTitle = 'eSIM eksik özellikler'
    target.worktree = {
      ...target.worktree,
      hostId: 'local',
      ...(host === 'local' ? {} : { runtimeOwnerEnvironmentId: host })
    }
    const consent: Extract<AgentHubRequest, { kind: 'consent' }> = {
      ...agentHubAskRequest(),
      kind: 'consent',
      caller: {
        kind: 'orb',
        sessionId: 'orb-session',
        paneKey: 'orb:orb-session',
        terminalHandle: 'orb:orb-session',
        title: 'Orb'
      },
      target: { paneKey: target.paneKey, terminalHandle: 'target-terminal' },
      operation: { kind: 'mirror', action: 'open' }
    }
    act(() => applyAgentHubDelivery(host, consent))
    render(
      <Inbox
        requestPresentationOf={(requestHost, request) =>
          agentHubRequestPresentation(
            useAppStore.getState(),
            [target],
            requestHost,
            request,
            () => presentation.location
          )
        }
      />
    )
    expect.soft(screen.getAllByText('Orb')).toHaveLength(1)
    expect
      .soft(
        screen.queryByRole('region', {
          name: '@Orb wants to open the mirror of eSIM eksik özellikler'
        })
      )
      .not.toBeNull()
    if (host === 'workhost') {
      expect(screen.getByText('workhost')).toBeTruthy()
    }
    expect(respond).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Allow once' })))
    expect(respond).toHaveBeenCalledExactlyOnceWith(host, consent.requestId, {
      kind: 'consent',
      decision: 'once'
    })
  }
)

it.each(['local', 'workhost'])(
  'shows the verified related agent and workspace separately from Orb on %s',
  (host) => {
    const target = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1 }])[0]
    target.paneTitle = 'Source task terminal'
    target.worktree = {
      ...target.worktree,
      hostId: 'local',
      ...(host === 'local' ? {} : { runtimeOwnerEnvironmentId: host })
    }
    const ask = agentHubAskRequest({
      caller: {
        kind: 'orb',
        sessionId: 'orb-session',
        paneKey: 'orb:orb-session',
        terminalHandle: 'orb:orb-session',
        title: 'Orb'
      },
      target: { paneKey: target.paneKey, terminalHandle: 'source-terminal' }
    })
    act(() => applyAgentHubDelivery(host, ask))
    render(
      <Inbox
        requestPresentationOf={(requestHost, request) =>
          agentHubRequestPresentation(
            useAppStore.getState(),
            [target],
            requestHost,
            request,
            () => ({
              group: 'Source group',
              project: 'Source project',
              workspace: 'feature/source',
              host
            })
          )
        }
      />
    )
    expect(screen.getByText('@Orb asks')).toBeTruthy()
    expect(screen.getByText('Source task terminal')).toBeTruthy()
    expect(screen.getByText(/Source project/)).toBeTruthy()
    expect(screen.getByText(/feature\/source/)).toBeTruthy()
    expect(screen.queryByText('@claude asks')).toBeNull()
  }
)

it('counts hub questions and consent plus needs-you notices, and dismisses a notice with ack', async () => {
  for (const level of ['info', 'done', 'needs-you'] as const) {
    receive(agentHubNotifyRequest({ requestId: level, level }))
  }
  const request = agentHubNotifyRequest({ requestId: 'needs-you', level: 'needs-you' })
  render(<Inbox />)
  expect(agentHubInboxRequests(readAgentHubRequests())).toHaveLength(1)
  expect(screen.getAllByText('Deployment ready')).toHaveLength(1)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' })))
  expect(respond).toHaveBeenCalledWith('workhost', request.requestId, { kind: 'ack' })
  close(request)
  expect(screen.queryByText('Deployment ready')).toBeNull()
  receive(agentHubAskRequest())
  receive({
    ...agentHubAskRequest({ requestId: 'consent' }),
    kind: 'consent',
    operation: { kind: 'canvas', action: 'open' }
  })
  expect(
    agentHubCounts(buildAgentHubLists([]), agentHubInboxRequests(readAgentHubRequests()).length)
      .needsYou
  ).toBe(2)
})

it('keeps the away-default answer as a dismissible Inbox line', () => {
  const ask = agentHubAskRequest()
  receive(ask)
  render(<Inbox />)
  act(() =>
    applyAgentHubDelivery('workhost', {
      ...ask,
      kind: 'closed',
      reason: 'responded',
      result: { answer: 'Second', index: 2, by: 'away-default', desktop: 'host' }
    })
  )
  expect(screen.queryByText('Which approach?')).toBeNull()
  expect(screen.getByText('@claude chose Second while you were away')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.queryByText('@claude chose Second while you were away')).toBeNull()
  expect(respond).not.toHaveBeenCalled()
})

it('keeps explicit Peek links visible but unavailable after their source terminal is gone', () => {
  receive(
    agentHubNotifyRequest({
      level: 'needs-you',
      links: ['https://example.com/report', '/workspace/report.pdf']
    })
  )
  render(<Inbox />)
  const links = screen.getAllByRole('button', { name: /^Peek at / })
  expect(links).toHaveLength(2)
  expect(links.every((link) => link.hasAttribute('disabled'))).toBe(true)
})

it('arms the existing numeric card control after its guard delay', async () => {
  vi.useFakeTimers()
  const ask = agentHubAskRequest()
  receive(ask)
  render(<Inbox />)
  expect(cardControl.current?.chooseOption(1)).toBe(false)
  act(() => vi.advanceTimersByTime(401))
  await act(async () => expect(cardControl.current?.chooseOption(1)).toBe(true))
  expect(respond).toHaveBeenCalledWith('workhost', ask.requestId, {
    kind: 'ask',
    answer: 'Second',
    index: 2
  })
})

it('shows a decision gate with its run, task and recommended option and counts it in Needs you', async () => {
  const gate = agentHubGateRequest()
  act(() => applyAgentHubDelivery('local', gate))
  render(<Inbox />)
  expect(screen.getByText('Decision gate')).toBeTruthy()
  expect(screen.getByText('Ship Orca · Choose strategy')).toBeTruthy()
  expect(screen.getByText('@claude asks')).toBeTruthy()
  expect(
    agentHubCounts(buildAgentHubLists([]), agentHubInboxRequests(readAgentHubRequests()).length)
      .needsYou
  ).toBe(1)
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '1 Small Recommended' }))
  )
  expect(respond).toHaveBeenCalledExactlyOnceWith('local', gate.gateId, {
    kind: 'ask',
    answer: 'Small (Recommended)',
    index: 1
  })
  act(() => applyAgentHubDelivery('local', { ...gate, kind: 'closed', reason: 'responded' }))
  expect(agentHubInboxRequests(readAgentHubRequests())).toHaveLength(0)
})

it('accepts a free-text gate answer and shows Answered elsewhere for a racing resolver', async () => {
  vi.useFakeTimers()
  const gate = agentHubGateRequest()
  respond.mockRejectedValue(Object.assign(new Error('resolved'), { code: 'already_resolved' }))
  act(() => applyAgentHubDelivery('local', gate))
  render(<Inbox />)
  const input = screen.getByRole('textbox', { name: 'Reply to @claude…' })
  fireEvent.change(input, { target: { value: 'A custom decision' } })
  const form = input.closest('form')
  if (!form) {
    throw new Error('Missing reply form')
  }
  await act(async () => fireEvent.submit(form))
  expect(respond).toHaveBeenCalledWith('local', gate.gateId, {
    kind: 'ask',
    answer: 'A custom decision',
    index: null
  })
  expect(screen.getByText('Answered elsewhere')).toBeTruthy()
  act(() => vi.advanceTimersByTime(1500))
  expect(screen.queryByText('Decision gate')).toBeNull()
})

it('keeps gate actions disabled when its paired host lacks user-gate-resolve capability', () => {
  receive(agentHubGateRequest())
  render(<Inbox />)
  expect(screen.getByText('Update this host to answer decision gates.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '1 Small Recommended' }))
  expect(respond).not.toHaveBeenCalled()
})
