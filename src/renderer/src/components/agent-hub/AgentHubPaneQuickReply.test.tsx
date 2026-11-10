/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { getDefaultSettings, getDefaultVoiceSettings } from '../../../../shared/constants'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'
import { TooltipProvider } from '../ui/tooltip'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import { AgentHubPaneQuickReplyPortals } from './AgentHubPaneQuickReply'
import { agentHubCardKey, resetAgentHubAnsweredCardsForTest } from './agent-hub-answered-cards'
import type * as QuickAnswerModule from './use-agent-hub-quick-answer'
import type { AgentHubQuickAnswer } from './use-agent-hub-quick-answer'

type QuickAnswerStub = Pick<
  AgentHubQuickAnswer,
  | 'question'
  | 'simpleQuestion'
  | 'options'
  | 'chosen'
  | 'pending'
  | 'canAnswer'
  | 'cardKey'
  | 'choose'
  | 'chooseByKey'
  | 'reply'
  | 'card'
  | 'keysArmed'
>
const quick = vi.hoisted(() => {
  const state: { answer: QuickAnswerStub; targets: unknown[] } = {
    answer: {
      question: 'Keep it?',
      simpleQuestion: null,
      options: [
        { id: 'a', label: 'Add delete', recommended: true, description: 'Adds a Delete action' },
        { id: 'b', label: 'Keep' }
      ],
      chosen: null,
      pending: false,
      canAnswer: true,
      cardKey: 'tab-1:leaf-1:1000',
      choose: vi.fn(() => true),
      chooseByKey: vi.fn(() => true),
      reply: vi.fn(() => true),
      card: null,
      keysArmed: () => true
    },
    targets: []
  }
  return state
})
const fullCard = vi.hoisted(() => ({ chooseOption: vi.fn(() => true), dismiss: () => {} }))
vi.mock('../native-chat/prompts/NativeChatInteractiveCard', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    NativeChatInteractiveCard: ({
      card,
      onDismiss,
      controlRef,
      answerInputRef,
      answerAccessory
    }: {
      card: { prompt: { questions: { question: string }[] } }
      onDismiss: () => void
      controlRef: React.Ref<{ chooseOption: (index: number) => boolean }>
      answerInputRef?: React.RefObject<HTMLTextAreaElement | null>
      answerAccessory?: React.ReactNode
    }) => {
      useImperativeHandle(controlRef, () => ({ chooseOption: fullCard.chooseOption }))
      fullCard.dismiss = onDismiss
      return (
        <div data-testid="full-card">
          {card.prompt.questions.map((question) => question.question).join(' / ')}
          <div data-testid="full-card-answer-row">
            <textarea ref={answerInputRef} aria-label="Full card answer" />
            {answerAccessory}
          </div>
        </div>
      )
    }
  }
})
vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/testing/app-store-test-fixture')
  return { useAppStore: createTestStore() }
})
vi.mock('./use-agent-hub-quick-answer', async (original) => ({
  ...(await original<typeof QuickAnswerModule>()),
  useAgentHubQuickAnswer: (target: unknown): QuickAnswerStub => {
    quick.targets.push(target)
    return quick.answer
  }
}))

const parsed = parsePaneKey(PANE_KEY)
if (!parsed) {
  throw new Error('expected a pane key')
}
const { tabId, leafId } = parsed
const asking: AgentStatusEntry = {
  state: 'waiting',
  prompt: 'Decide',
  updatedAt: 1_000,
  stateStartedAt: 1_000,
  paneKey: PANE_KEY,
  terminalTitle: 'Agent',
  stateHistory: [],
  agentType: 'claude',
  interactivePrompt: JSON.stringify({ questions: [{ question: 'Keep it?', options: [] }] })
}

function mountPane(): {
  id: number
  leafId: typeof leafId
  container: HTMLElement
  terminal: { focus: () => void }
} {
  const container = document.createElement('div')
  container.className = 'pane'
  const input = document.createElement('textarea')
  input.className = 'xterm-helper-textarea'
  container.append(input)
  document.body.append(container)
  return { id: 7, leafId, container, terminal: { focus: () => input.focus() } }
}

function renderPortals(pane: ReturnType<typeof mountPane>) {
  return render(
    <TooltipProvider>
      <AgentHubPaneQuickReplyPortals panes={[pane]} tabId={tabId} worktreeId="wt-1" />
    </TooltipProvider>
  )
}

const card = (): HTMLElement | null => document.querySelector('[data-agent-hub-pane-quick-reply]')
const openCard = (): HTMLElement => {
  const element = card()
  if (!element) {
    throw new Error('expected the quick reply card')
  }
  return element
}

beforeEach(() => {
  resetAgentHubAnsweredCardsForTest()
  quick.targets.length = 0
  quick.answer.chosen = null
  quick.answer.pending = false
  quick.answer.simpleQuestion = null
  quick.answer.cardKey = agentHubCardKey(PANE_KEY, 1_000, asking.interactivePrompt ?? null)
  vi.mocked(quick.answer.choose).mockClear()
  vi.mocked(quick.answer.chooseByKey).mockClear()
  fullCard.chooseOption.mockClear()
  quick.answer.card = null
  quick.answer.options = [
    { id: 'a', label: 'Add delete', recommended: true, description: 'Adds a Delete action' },
    { id: 'b', label: 'Keep' }
  ]
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home/u'), experimentalAgentHub: true },
    agentStatusByPaneKey: {}
  })
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it('opens in the asking pane with its options and answers by click or number key', () => {
  const pane = mountPane()
  renderPortals(pane)
  expect(card()).toBeNull()

  act(() => useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } }))
  expect(card()?.closest('.pane')).toBe(pane.container)
  expect(quick.targets.at(-1)).toMatchObject({
    worktreeId: 'wt-1',
    tabId,
    paneKey: PANE_KEY,
    agentType: 'claude',
    stateSince: 1_000
  })
  expect(screen.getByText('Keep it?')).toBeTruthy()
  // The option's description is what tells the choices apart; the card keeps it.
  expect(screen.getByText('Adds a Delete action')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: /Keep$/ }))
  expect(quick.answer.choose).toHaveBeenCalledWith(1, expect.any(Function))

  fireEvent.keyDown(openCard(), { key: '1' })
  expect(quick.answer.chooseByKey).toHaveBeenCalledWith(0, expect.any(Function))
})

it("takes several questions in the agent's full card, keeping the keys until all are sent", () => {
  quick.answer.options = []
  quick.answer.card = {
    kind: 'question',
    prompt: {
      questions: [
        { question: 'Plan?', multiSelect: false, options: [{ label: 'Yes' }] },
        { question: 'Ship?', multiSelect: false, options: [{ label: 'Now' }] }
      ]
    }
  }
  const pane = mountPane()
  renderPortals(pane)
  act(() => useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } }))
  expect(screen.getByTestId('full-card').textContent).toBe('Plan? / Ship?')
  expect(openCard().textContent).toContain('is asking')

  act(() => openCard().focus())
  fireEvent.keyDown(openCard(), { key: '2' })
  expect(fullCard.chooseOption).toHaveBeenCalledWith(1)
  // The next question follows in the same card, so the terminal does not take the keys yet.
  expect(openCard().contains(document.activeElement)).toBe(true)

  act(() => fullCard.dismiss())
  expect(card()).toBeNull()
})

it('dictates only into the full card answer, and refuses while that field is disabled', () => {
  quick.answer.options = []
  quick.answer.card = {
    kind: 'question',
    prompt: {
      questions: [
        { question: 'Plan?', multiSelect: false, options: [{ label: 'Yes' }] },
        { question: 'Ship?', multiSelect: false, options: [{ label: 'Now' }] }
      ]
    }
  }
  const settings = getDefaultSettings('/home/u')
  useAppStore.setState({
    settings: {
      ...settings,
      experimentalAgentHub: true,
      voice: { ...getDefaultVoiceSettings(), enabled: true }
    },
    agentStatusByPaneKey: { [PANE_KEY]: asking },
    dictationState: 'idle'
  })
  const pane = mountPane()
  pane.terminal.focus()
  renderPortals(pane)
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Full card answer' })
  // The mic belongs to the answer field's row, not a separate strip under the card.
  expect(
    screen
      .getByTestId('full-card-answer-row')
      .contains(screen.getByRole('button', { name: 'Dictate' }))
  ).toBe(true)
  const onControl = vi.fn(() => expect(document.activeElement).toBe(input))
  document.addEventListener(DICTATION_CONTROL_EVENT, onControl)
  try {
    input.disabled = true
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    expect(onControl).not.toHaveBeenCalled()
    input.disabled = false
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }))
    expect(onControl).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(input)
  } finally {
    document.removeEventListener(DICTATION_CONTROL_EVENT, onControl)
  }
})

it('shows the answer going out instead of standing still', () => {
  quick.answer.chosen = 1
  renderPortals(mountPane())
  act(() => useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } }))
  expect(openCard().getAttribute('aria-busy')).toBe('true')
  expect(screen.getByRole('status').textContent).toContain('Sending…')
  // A second click on any option cannot send again.
  expect(screen.getByRole('button', { name: /Keep$/ }).hasAttribute('disabled')).toBe(true)
})

it('takes the keys only from its own terminal, and hands them back when it leaves', () => {
  const pane = mountPane()
  pane.terminal.focus()
  useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } })
  renderPortals(pane)
  expect(document.activeElement).toBe(openCard())

  // The prompt clears while the card has the keys: the terminal gets them back.
  act(() => useAppStore.setState({ agentStatusByPaneKey: {} }))
  expect(card()).toBeNull()
  expect(document.activeElement?.classList.contains('xterm-helper-textarea')).toBe(true)
})

it('closes on Esc for this prompt, hands the keys to the terminal, and returns for the next', () => {
  const pane = mountPane()
  useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } })
  renderPortals(pane)
  expect(card()).not.toBeNull()

  fireEvent.keyDown(openCard(), { key: 'Escape' })
  expect(card()).toBeNull()
  expect(document.activeElement?.classList.contains('xterm-helper-textarea')).toBe(true)

  // A handle stays in the corner while the prompt stands; it brings the card back.
  const handle = pane.container.querySelector<HTMLButtonElement>(
    '[data-agent-hub-pane-quick-reply-handle]'
  )
  expect(handle).not.toBeNull()
  fireEvent.click(handle!)
  expect(card()).not.toBeNull()
  expect(document.activeElement).toBe(openCard())
  fireEvent.keyDown(openCard(), { key: 'Escape' })
  expect(card()).toBeNull()

  // A second question in the same turn (same state start) is a fresh card too.
  const secondPrompt = JSON.stringify({ questions: [{ question: 'Ship it?', options: [] }] })
  quick.answer.cardKey = agentHubCardKey(PANE_KEY, 1_000, secondPrompt)
  act(() =>
    useAppStore.setState({
      agentStatusByPaneKey: { [PANE_KEY]: { ...asking, interactivePrompt: secondPrompt } }
    })
  )
  expect(card()).not.toBeNull()
  fireEvent.keyDown(openCard(), { key: 'Escape' })
  expect(card()).toBeNull()

  quick.answer.cardKey = agentHubCardKey(PANE_KEY, 2_000, asking.interactivePrompt ?? null)
  act(() =>
    useAppStore.setState({
      agentStatusByPaneKey: { [PANE_KEY]: { ...asking, stateStartedAt: 2_000, updatedAt: 2_000 } }
    })
  )
  expect(card()).not.toBeNull()
  expect(pane.container.querySelector('[data-agent-hub-pane-quick-reply-handle]')).toBeNull()
})

it('keeps the draft when Escape belongs to IME composition', () => {
  quick.answer.simpleQuestion = { question: 'Keep it?', multiSelect: false, options: [] }
  const pane = mountPane()
  useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } })
  renderPortals(pane)
  const input = screen.getByRole('textbox', { name: 'Your own answer…' })
  fireEvent.change(input, { target: { value: '日本語' } })
  fireEvent.keyDown(input, { key: 'Escape', isComposing: true })
  expect(card()).not.toBeNull()
  expect(input).toHaveProperty('value', '日本語')
  fireEvent.keyDown(input, { key: 'Escape', isComposing: false })
  expect(card()).toBeNull()
})

it('stays away from a pane a chat view covers', () => {
  const pane = mountPane()
  const shell = document.createElement('div')
  shell.className = 'native-chat-pane-shell'
  pane.container.append(shell)
  useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } })
  renderPortals(pane)
  expect(card()).toBeNull()
})

it('stays away while the setting or Agent Hub is off, and in a paired web-client window', () => {
  const pane = mountPane()
  useAppStore.setState({
    agentStatusByPaneKey: { [PANE_KEY]: asking },
    settings: {
      ...getDefaultSettings('/home/u'),
      experimentalAgentHub: true,
      agentHubPaneQuickReply: false
    }
  })
  const off = renderPortals(pane)
  expect(card()).toBeNull()
  off.unmount()

  useAppStore.setState({
    settings: { ...getDefaultSettings('/home/u'), experimentalAgentHub: true }
  })
  vi.stubGlobal('__ORCA_WEB_CLIENT__', true)
  renderPortals(pane)
  expect(card()).toBeNull()
})
