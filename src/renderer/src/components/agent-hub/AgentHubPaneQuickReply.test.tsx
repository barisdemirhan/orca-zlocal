/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { getDefaultSettings } from '../../../../shared/constants'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubPaneQuickReplyPortals } from './AgentHubPaneQuickReply'
import { resetAgentHubPaneQuickReplyDismissalsForTest } from './agent-hub-pane-quick-reply-dismissal'
import type { AgentHubQuickAnswer } from './use-agent-hub-quick-answer'

const quick = vi.hoisted(() => {
  const state: { answer: AgentHubQuickAnswer; targets: unknown[] } = {
    answer: {
      question: 'Keep it?',
      options: [
        { id: 'a', label: 'Add delete', recommended: true },
        { id: 'b', label: 'Keep' }
      ],
      chosen: null,
      canAnswer: true,
      choose: vi.fn(() => true),
      reply: vi.fn(() => true)
    },
    targets: []
  }
  return state
})
vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/slices/store-test-helpers')
  return { useAppStore: createTestStore() }
})
vi.mock('./use-agent-hub-quick-answer', () => ({
  useAgentHubQuickAnswer: (target: unknown) => {
    quick.targets.push(target)
    return quick.answer
  }
}))

const [tabId, leafId] = PANE_KEY.split(':')
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

function mountPane(): { id: number; leafId: string; container: HTMLElement } {
  const container = document.createElement('div')
  container.className = 'pane'
  const input = document.createElement('textarea')
  input.className = 'xterm-helper-textarea'
  container.append(input)
  document.body.append(container)
  return { id: 7, leafId: leafId ?? 'leaf', container }
}

function renderPortals(pane: ReturnType<typeof mountPane>) {
  return render(
    <TooltipProvider>
      <AgentHubPaneQuickReplyPortals panes={[pane]} tabId={tabId ?? 'tab'} worktreeId="wt-1" />
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
  resetAgentHubPaneQuickReplyDismissalsForTest()
  quick.targets.length = 0
  vi.mocked(quick.answer.choose).mockClear()
  useAppStore.setState({
    settings: { ...getDefaultSettings('/home/u'), experimentalAgentHub: true },
    agentStatusByPaneKey: {}
  })
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
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

  fireEvent.click(screen.getByRole('button', { name: /Keep$/ }))
  expect(quick.answer.choose).toHaveBeenCalledWith(1)

  fireEvent.keyDown(openCard(), { key: '1' })
  expect(quick.answer.choose).toHaveBeenCalledWith(0)
})

it('closes on Esc for this prompt, hands the keys to the terminal, and returns for the next', () => {
  const pane = mountPane()
  useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: asking } })
  renderPortals(pane)
  expect(card()).not.toBeNull()

  fireEvent.keyDown(openCard(), { key: 'Escape' })
  expect(card()).toBeNull()
  expect(document.activeElement?.classList.contains('xterm-helper-textarea')).toBe(true)

  act(() =>
    useAppStore.setState({
      agentStatusByPaneKey: { [PANE_KEY]: { ...asking, stateStartedAt: 2_000, updatedAt: 2_000 } }
    })
  )
  expect(card()).not.toBeNull()
})

it('stays away while the setting or Agent Hub is off', () => {
  const pane = mountPane()
  useAppStore.setState({
    agentStatusByPaneKey: { [PANE_KEY]: asking },
    settings: {
      ...getDefaultSettings('/home/u'),
      experimentalAgentHub: true,
      agentHubPaneQuickReply: false
    }
  })
  renderPortals(pane)
  expect(card()).toBeNull()
})
