import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
// @vitest-environment happy-dom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { NativeChatInteractiveSend } from '../native-chat/session/terminal/send/use-native-chat-interactive-send'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { buildActivityEvents } from '../activity/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  AGENT_HUB_CARD_KEY_GUARD_MS,
  AgentHubAttentionCard,
  type AgentHubCardControl
} from './AgentHubAttentionCard'
import {
  AGENT_HUB_ANSWER_HOLD_MS,
  agentHubThreadCardKey,
  isAgentHubCardDismissed,
  resetAgentHubAnsweredCardsForTest
} from './agent-hub-answered-cards'
import { AgentHubPaneQuickReplyPortals } from './AgentHubPaneQuickReply'

const send = vi.hoisted(() => ({
  sendAnswer: vi.fn<NativeChatInteractiveSend['sendAnswer']>(),
  sendRaw: vi.fn(),
  sendRawVerified: vi.fn(async () => true),
  cancelPending: vi.fn(),
  cancelAsk: vi.fn(async () => true),
  cancel: vi.fn()
}))

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

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let lastThread: AgentPaneThread

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance', 'Date', 'setTimeout', 'requestAnimationFrame'] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  Object.values(send).forEach((fn) => fn.mockClear())
  resetAgentHubAnsweredCardsForTest()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function renderAttentionCard(
  agentType: string,
  interactivePrompt = JSON.stringify({ approval: { tool: 'bash', summary: 'pnpm test' } }),
  pane?: Parameters<typeof AgentHubPaneQuickReplyPortals>[0]['panes'][number]
) {
  const worktree = makeWorktree()
  const repo = makeRepo()
  const tab = makeTabWithIds('tab-1', worktree.id)
  const entry: AgentStatusEntry = {
    state: 'waiting',
    prompt: 'Run the tests',
    updatedAt: 1_000,
    stateStartedAt: 1_000,
    paneKey: PANE_KEY,
    terminalTitle: 'Agent',
    stateHistory: [],
    agentType,
    interactivePrompt
  }
  useAppStore.setState({
    agentStatusByPaneKey: acceptedAgentStatuses(Object.entries({ [PANE_KEY]: entry }))
  })
  const [thread] = makeThreads(
    buildActivityEvents({
      chatNames: new Map(),
      agentStatusByPaneKey: acceptedAgentStatuses(Object.entries({ [PANE_KEY]: entry })),
      tabsByWorktree: { [worktree.id]: [tab] },
      worktreeMap: new Map([[worktree.id, worktree]]),
      repoMap: new Map([[repo.id, repo]]),
      acknowledgedAgentsByPaneKey: {},
      now: 1_000
    })
  )
  if (!thread) {
    throw new Error('expected a thread')
  }
  lastThread = thread
  const control = createRef<AgentHubCardControl>()
  act(() => {
    root.render(
      <TooltipProvider>
        <AgentHubAttentionCard
          thread={thread}
          location={{ group: null, project: 'Repo', workspace: 'feature' }}
          now={1_000}
          popoutKeys={[]}
          controlRef={control}
          onJump={() => {}}
          onPopout={() => {}}
        />
        {pane ? (
          <AgentHubPaneQuickReplyPortals panes={[pane]} tabId={tab.id} worktreeId={worktree.id} />
        ) : null}
      </TooltipProvider>
    )
  })
  return control
}

function afterGuard(): void {
  act(() => {
    vi.advanceTimersByTime(AGENT_HUB_CARD_KEY_GUARD_MS)
  })
}

it.each([
  ['opencode', '\r'],
  ['claude', '1']
])('allows a %s approval once with the key its prompt expects', async (agentType, key) => {
  const control = renderAttentionCard(agentType)
  afterGuard()

  await act(async () => {
    expect(control.current?.chooseOption(0)).toBe(true)
  })
  expect(send.sendRawVerified).toHaveBeenCalledWith(key)
})

it('denies with a single Escape, not the Stop sequence', async () => {
  const control = renderAttentionCard('opencode')
  afterGuard()

  // The deny option first asks for an instruction; an empty reply denies plainly.
  let chose = false
  act(() => {
    chose = control.current?.chooseOption(1) ?? false
  })
  expect(chose).toBe(true)
  const form = container.querySelector('form')
  expect(form).not.toBeNull()
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  expect(send.cancelAsk).toHaveBeenCalledTimes(1)
  expect(send.cancel).not.toHaveBeenCalled()
})

it('keeps a reopened card answered while its answer is on the way, then allows a retry', async () => {
  const first = renderAttentionCard('claude')
  afterGuard()
  await act(async () => {
    expect(first.current?.chooseOption(0)).toBe(true)
  })

  act(() => root.render(<div />))
  const reopened = renderAttentionCard('claude')
  afterGuard()
  expect(reopened.current?.chooseOption(0)).toBe(false)
  expect(send.sendRawVerified).toHaveBeenCalledTimes(1)

  act(() => {
    vi.advanceTimersByTime(AGENT_HUB_ANSWER_HOLD_MS)
  })
  act(() => root.render(<div />))
  const later = renderAttentionCard('claude')
  afterGuard()
  await act(async () => {
    expect(later.current?.chooseOption(0)).toBe(true)
  })
  expect(send.sendRawVerified).toHaveBeenCalledTimes(2)
})

it('hides from the Inbox without answering, and keeps the agent waiting', () => {
  renderAttentionCard('claude')
  afterGuard()
  const hide = container.querySelector<HTMLButtonElement>('[data-agent-hub-card-hide]')
  act(() => hide?.click())
  expect(isAgentHubCardDismissed(agentHubThreadCardKey(lastThread), 'inbox')).toBe(true)
  expect(send.sendRawVerified).not.toHaveBeenCalled()
  expect(send.cancelAsk).not.toHaveBeenCalled()
})

it.each(['pane', 'hub'] as const)(
  'finishes a full answer from the %s after Esc, with no second answer on the other card',
  (sender) => {
    const parsed = parsePaneKey(PANE_KEY)
    if (!parsed) {
      throw new Error('No pane key')
    }
    const paneContainer = document.createElement('div')
    const terminalInput = document.createElement('textarea')
    terminalInput.className = 'xterm-helper-textarea'
    paneContainer.append(terminalInput)
    document.body.append(paneContainer)
    const pane = {
      id: 7,
      leafId: parsed.leafId,
      container: paneContainer,
      terminal: { focus: () => terminalInput.focus() }
    }
    let finish: ((delivered: boolean) => void) | undefined
    send.sendAnswer.mockImplementation((_prompt, _selections, onSettled) => {
      finish = onSettled
      return { settleAfterMs: 5_000 }
    })
    useAppStore.setState({
      settings: { ...getDefaultSettings('/home/u'), experimentalAgentHub: true }
    })
    try {
      const control = renderAttentionCard(
        'claude',
        JSON.stringify({
          questions: [
            { question: 'Plan?', options: [{ label: 'Yes' }] },
            { question: 'Ship?', options: [{ label: 'Now' }] }
          ]
        }),
        pane
      )
      afterGuard()
      expect(
        document.querySelectorAll('[data-testid="native-chat-question-card-title"]')
      ).toHaveLength(2)
      const card = paneContainer.querySelector('[data-agent-hub-pane-quick-reply]')
      if (!card) {
        throw new Error('No pane card')
      }
      const choose = (): void => {
        if (sender === 'pane') {
          fireEvent.keyDown(card, { key: '1' })
        } else {
          expect(control.current?.chooseOption(0)).toBe(true)
        }
      }
      act(choose)
      act(choose)
      expect(send.sendAnswer).toHaveBeenCalledWith(
        expect.anything(),
        [
          { indices: [0], other: '' },
          { indices: [0], other: '' }
        ],
        expect.any(Function)
      )
      expect(
        document.querySelectorAll('[data-testid="native-chat-question-card-title"]')
      ).toHaveLength(0)
      expect(within(paneContainer).getByRole('status').textContent).toContain('Sending')
      fireEvent.keyDown(card, { key: 'Escape' })
      expect(paneContainer.querySelector('[data-agent-hub-pane-quick-reply]')).toBeNull()
      expect(send.cancelPending).not.toHaveBeenCalled()
      expect(control.current?.chooseOption(0)).toBe(false)
      act(() => finish?.(true))
      expect(send.sendAnswer).toHaveBeenCalledOnce()
      expect(send.cancelPending).not.toHaveBeenCalled()
    } finally {
      paneContainer.remove()
    }
  }
)
