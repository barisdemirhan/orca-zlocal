/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  makeRepo,
  makeWorktree,
  makeTabWithIds,
  PANE_KEY,
  PANE_KEY_2
} from '../activity/ActivityPrototypePage-test-fixtures'
import type { NativeChatInteractiveSend } from '../native-chat/session/terminal/send/use-native-chat-interactive-send'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubAnswerQueue } from './AgentHubAnswerQueue'
import {
  agentHubThreadCardKey,
  recordAgentHubCardAnswer,
  resetAgentHubAnsweredCardsForTest
} from './agent-hub-answered-cards'
import { useAgentHubAnswerQueueState } from './agent-hub-answer-queue-store'
import { applyAgentHubDelivery, clearAgentHubRequestHost } from './agent-hub-requests-store'
import { agentHubLocation } from './agent-hub-pane-target'
import { agentHubAskRequest } from './agent-hub-request-test-fixtures'
import { AGENT_HUB_CARD_KEY_GUARD_MS } from './use-agent-hub-quick-answer'

const send = vi.hoisted(() => ({
  sendAnswer: vi.fn<NativeChatInteractiveSend['sendAnswer']>(() => ({ settleAfterMs: 800 })),
  sendRaw: vi.fn(),
  sendRawVerified: vi.fn(async () => true),
  cancelPending: vi.fn(),
  cancelAsk: vi.fn(async () => true),
  cancel: vi.fn()
}))
const toast = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast }))
vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})
vi.mock('./use-agent-hub-live-pty', () => ({ useAgentHubLivePty: () => 'pty-1' }))
vi.mock('../native-chat/host-access/use-native-chat-can-send', () => ({
  useNativeChatCanSend: () => true
}))
vi.mock('../native-chat/session/terminal/send/use-native-chat-interactive-send', () => ({
  useNativeChatInteractiveSend: () => send
}))
vi.mock('./AgentHubDictateButton', () => ({
  HubDictateButton: () => <button type="button" aria-label="Dictate answer" />
}))

function thread(
  paneKey = PANE_KEY,
  question = 'Choose a release?',
  arrivedAt = 1000
): AgentPaneThread {
  const worktree = makeWorktree()
  const entry: AgentStatusEntry = {
    state: 'waiting',
    prompt: 'Release',
    updatedAt: arrivedAt,
    stateStartedAt: arrivedAt,
    paneKey,
    stateHistory: [],
    agentType: 'claude',
    lastAssistantMessage: 'The implementation is ready.\nPick the next step.',
    interactivePrompt: JSON.stringify({
      questions: [
        {
          question,
          options: [
            { label: 'Beta (Recommended)', description: 'Private testing' },
            { label: 'Production', description: 'Public release' }
          ]
        }
      ]
    })
  }
  return {
    paneKey,
    paneTitle: 'Release',
    worktree,
    repo: makeRepo(),
    tab: makeTabWithIds(paneKey.split(':')[0], worktree.id),
    agentType: 'claude',
    currentAgentState: 'waiting',
    currentAgentEntry: entry,
    paneEntry: entry,
    responsePreview: '',
    latestTimestamp: arrivedAt,
    latestEvent: null,
    events: [],
    unread: true
  }
}

const onJump = vi.fn()
const locationOf: React.ComponentProps<typeof AgentHubAnswerQueue>['locationOf'] = (target) =>
  agentHubLocation(target, new Map())
const requestPresentationOf: React.ComponentProps<
  typeof AgentHubAnswerQueue
>['requestPresentationOf'] = () => ({
  title: 'CLI',
  targetTitle: 'CLI',
  target: null,
  location: { project: 'Repo', workspace: null, group: null }
})

function publish(threads: readonly AgentPaneThread[]): void {
  useAppStore.setState({
    agentStatusByPaneKey: Object.fromEntries(
      threads.flatMap((item) =>
        item.currentAgentEntry ? [[item.paneKey, item.currentAgentEntry]] : []
      )
    )
  })
}
function mount(threads: AgentPaneThread[]) {
  publish(threads)
  return render(queueView(threads))
}
function queueView(threads: AgentPaneThread[]) {
  return (
    <TooltipProvider>
      <AgentHubAnswerQueue
        threads={threads}
        locationOf={locationOf}
        requestPresentationOf={requestPresentationOf}
        onJump={onJump}
      />
    </TooltipProvider>
  )
}
function advance(ms = 250): void {
  act(() => vi.advanceTimersByTime(ms))
}
function currentDialog(): HTMLElement {
  return screen.getByRole('dialog')
}
function settings(
  changes: Partial<NonNullable<ReturnType<typeof useAppStore.getState>['settings']>>
): void {
  const existing = useAppStore.getState().settings
  if (!existing) {
    throw new Error('expected settings')
  }
  useAppStore.setState({ settings: { ...existing, ...changes } })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  send.sendAnswer.mockReturnValue({ settleAfterMs: 800 })
  send.sendRawVerified.mockResolvedValue(true)
  send.cancelAsk.mockResolvedValue(true)
  resetAgentHubAnsweredCardsForTest()
  useAgentHubAnswerQueueState.setState({ open: false, enabled: false, count: 0 })
  useAppStore.setState({
    settings: {
      ...getDefaultSettings('/home/u'),
      experimentalAgentHub: true,
      agentHubAnswerQueue: true
    },
    agentStatusByPaneKey: {},
    repos: [makeRepo()],
    sshTargetLabels: new Map(),
    sshConnectionStates: new Map(),
    runtimeEnvironments: [],
    runtimeStatusByEnvironmentId: new Map()
  })
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  clearAgentHubRequestHost('local')
  resetAgentHubAnsweredCardsForTest()
  vi.useRealTimers()
})

it('opens the first question with its context, source and microphone without showing other cards', () => {
  mount([thread(), thread(PANE_KEY_2, 'Choose a region?', 2000)])
  expect(currentDialog().textContent).toContain('Choose a release?')
  expect(currentDialog().textContent).not.toContain('Choose a region?')
  expect(currentDialog().textContent).toContain('Pick the next step.')
  expect(currentDialog().textContent).toContain('Repo')
  expect(currentDialog().textContent).toContain('feature')
  expect(screen.getByRole('button', { name: 'Dictate answer' })).toBeTruthy()
  expect(screen.getByText('2 waiting')).toBeTruthy()
})

it('waits until typing stops before opening automatically', () => {
  const input = document.createElement('textarea')
  document.body.append(input)
  input.focus()
  const first = thread()
  const view = mount([])
  fireEvent.keyDown(input, { key: 'a' })
  act(() => publish([first]))
  view.rerender(queueView([first]))
  expect(screen.queryByRole('dialog')).toBeNull()
  advance(1500)
  fireEvent.keyDown(input, { key: 'b' })
  advance(1999)
  expect(screen.queryByRole('dialog')).toBeNull()
  advance(1)
  expect(currentDialog()).toBeTruthy()
  input.remove()
})

it('supports manual opening and Later without a newly arrived question jumping the queue', () => {
  settings({ agentHubAnswerQueueOpening: 'shortcut' })
  const first = thread()
  const second = thread(PANE_KEY_2, 'Choose a region?', 2000)
  mount([second, first])
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /2 waiting/ }))
  expect(currentDialog().textContent).toContain('Choose a release?')
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  advance()
  expect(currentDialog().textContent).toContain('Choose a region?')
  const isMac = navigator.userAgent.includes('Mac')
  fireEvent.keyDown(document.activeElement ?? currentDialog(), {
    key: 'ArrowRight',
    metaKey: isMac,
    ctrlKey: !isMac
  })
  advance()
  expect(currentDialog().textContent).toContain('Choose a release?')
  expect(send.sendAnswer).not.toHaveBeenCalled()
})

it('does not report an unverifiable host while a local card animates out', () => {
  mount([thread(), thread(PANE_KEY_2, 'Choose a region?', 2000)])
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  expect(currentDialog().textContent).toContain('Choose a release?')
  expect(currentDialog().textContent).not.toContain('unverifiable')
  advance()
  expect(currentDialog().textContent).toContain('Choose a region?')
})

it('removes an answer from another surface immediately and announces it once', () => {
  const first = thread()
  mount([first, thread(PANE_KEY_2, 'Choose a region?', 2000)])
  act(() => {
    recordAgentHubCardAnswer(agentHubThreadCardKey(first), 0)(true)
  })
  advance()
  expect(currentDialog().textContent).toContain('Choose a region?')
  expect(screen.getByText('1 waiting')).toBeTruthy()
  expect(toast).toHaveBeenCalledWith('Answered elsewhere', { duration: 1500 })
})

it('uses native number-key choices, advances only after delivery, and restores focus when caught up', () => {
  const input = document.createElement('textarea')
  document.body.append(input)
  input.focus()
  const first = thread()
  if (!first.currentAgentEntry) {
    throw new Error('expected status')
  }
  first.currentAgentEntry.interactivePrompt = JSON.stringify({
    questions: [
      { question: 'Choose a release?', options: [{ label: 'Beta' }, { label: 'Production' }] },
      {
        question: 'Pick the checks',
        multiSelect: true,
        options: [{ label: 'Typecheck' }, { label: 'Tests' }]
      }
    ]
  })
  mount([first])
  advance(AGENT_HUB_CARD_KEY_GUARD_MS)
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '2', repeat: true })
  expect(currentDialog().textContent).not.toContain('Pick the checks')
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '2' })
  expect(currentDialog().textContent).toContain('Pick the checks')
  expect(send.sendAnswer).not.toHaveBeenCalled()
  advance(AGENT_HUB_CARD_KEY_GUARD_MS)
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '1' })
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '2' })
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: 'Enter' })
  advance(500)
  expect(send.sendAnswer).toHaveBeenCalledWith(
    expect.anything(),
    [
      { indices: [1], other: '' },
      { indices: [0, 1], other: '' }
    ],
    expect.any(Function)
  )
  expect(currentDialog().textContent).not.toContain('All caught up')
  act(() => send.sendAnswer.mock.calls[0]?.[2]?.(true))
  expect(screen.getByRole('status').textContent).toContain('All caught up')
  expect(toast).not.toHaveBeenCalled()
  advance(1250)
  advance(1)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(input)
  input.remove()
})

it('ignores answer keys right after opening and after the card changes, but not Escape', () => {
  mount([thread(), thread(PANE_KEY_2, 'Choose a region?', 2000)])
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '1' })
  advance(100)
  expect(send.sendAnswer).not.toHaveBeenCalled()
  advance(AGENT_HUB_CARD_KEY_GUARD_MS)
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  advance()
  expect(currentDialog().textContent).toContain('Choose a region?')
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '1' })
  advance(100)
  expect(send.sendAnswer).not.toHaveBeenCalled()
  advance(AGENT_HUB_CARD_KEY_GUARD_MS)
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '1' })
  advance(500)
  expect(send.sendAnswer).toHaveBeenCalledOnce()
})

it('closes on Escape immediately after opening', () => {
  mount([thread()])
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: 'Escape' })
  advance()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps a failed delivery available for retry', () => {
  mount([thread()])
  advance(AGENT_HUB_CARD_KEY_GUARD_MS)
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '1' })
  advance(500)
  act(() => send.sendAnswer.mock.calls[0]?.[2]?.(false))
  expect(currentDialog().textContent).toContain('Choose a release?')
  expect(useAgentHubAnswerQueueState.getState().count).toBe(1)
})

it('closes on Escape without answering and ignores shade clicks', () => {
  mount([thread()])
  const shade = document.querySelector('[data-agent-hub-answer-queue-shade]')
  if (!shade) {
    throw new Error('expected queue shade')
  }
  fireEvent.click(shade)
  expect(currentDialog()).toBeTruthy()
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: 'Escape' })
  advance()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(send.cancelAsk).not.toHaveBeenCalled()
  expect(send.sendAnswer).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /1 waiting/ })).toBeTruthy()
})

it('opens the source pane and closes the queue', () => {
  const first = thread()
  mount([first])
  fireEvent.click(screen.getByRole('button', { name: 'Open in terminal' }))
  expect(onJump).toHaveBeenCalledWith(
    expect.objectContaining({
      thread: first,
      target: expect.objectContaining({ paneKey: PANE_KEY })
    })
  )
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('excludes approvals until enabled and sends Allow through the shared approval path', async () => {
  const approval = thread()
  if (!approval.currentAgentEntry) {
    throw new Error('expected status')
  }
  approval.currentAgentEntry.interactivePrompt = JSON.stringify({
    approval: { tool: 'Bash', summary: 'pnpm test' }
  })
  mount([approval])
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => settings({ agentHubAnswerQueueIncludeApprovals: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Allow' }))
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(send.sendRawVerified).toHaveBeenCalled()
  expect(screen.getByRole('status').textContent).toContain('All caught up')
})

it('keeps a remote question and disables sending while its host is unverifiable', () => {
  const first = thread()
  first.worktree.hostId = 'ssh:workhost'
  useAppStore.setState({
    sshTargetLabels: new Map([['workhost', 'Build server']]),
    sshConnectionStates: new Map([
      ['workhost', { targetId: 'workhost', status: 'connected', error: null, reconnectAttempt: 0 }]
    ])
  })
  const view = mount([first])
  expect(currentDialog().textContent).toContain('Build server')
  act(() => useAppStore.setState({ agentStatusByPaneKey: {}, sshConnectionStates: new Map() }))
  view.rerender(queueView([]))
  expect(currentDialog().textContent).toContain('Choose a release?')
  expect(currentDialog().textContent).toContain('unverifiable')
  advance(AGENT_HUB_CARD_KEY_GUARD_MS)
  fireEvent.keyDown(document.activeElement ?? currentDialog(), { key: '1' })
  advance(500)
  expect(send.sendAnswer).not.toHaveBeenCalled()
  expect(useAgentHubAnswerQueueState.getState().count).toBe(1)
  expect(toast).not.toHaveBeenCalled()
})

it('queues Hub CLI questions already present in the shared request store', () => {
  const request = agentHubAskRequest({ requestId: 'cli-ask', question: 'Ship the CLI?' })
  applyAgentHubDelivery('local', request)
  mount([])
  expect(currentDialog().textContent).toContain('Ship the CLI?')
  act(() => applyAgentHubDelivery('local', { ...request, kind: 'closed', reason: 'responded' }))
  expect(screen.getByRole('status').textContent).toContain('All caught up')
})

it('renders no queue or waiting pill when the setting is off', () => {
  settings({ agentHubAnswerQueue: false })
  mount([thread()])
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('button', { name: /waiting/ })).toBeNull()
})

it('removes a stopped agent even when its old structured prompt remains in the status row', () => {
  const first = thread()
  mount([first])
  const entry = first.currentAgentEntry
  if (!entry) {
    throw new Error('expected status')
  }
  act(() =>
    useAppStore.setState({
      agentStatusByPaneKey: { [PANE_KEY]: { ...entry, state: 'done' } }
    })
  )
  expect(screen.getByRole('status').textContent).toContain('All caught up')
  expect(useAgentHubAnswerQueueState.getState().count).toBe(0)
})

it('identifies folder workspaces without inventing a branch', () => {
  const first = thread()
  first.repo = null
  first.worktree = { ...first.worktree, branch: '', displayName: 'Notes folder' }
  mount([first])
  expect(currentDialog().textContent).toContain('Notes folder')
  expect(currentDialog().textContent).not.toContain('feature')
})
