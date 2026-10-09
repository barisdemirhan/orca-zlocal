// @vitest-environment happy-dom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
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

const send = vi.hoisted(() => ({
  sendAnswer: vi.fn(),
  sendRaw: vi.fn(),
  cancelPending: vi.fn(),
  cancelAsk: vi.fn(),
  cancel: vi.fn()
}))

vi.mock('@/store', async () => {
  const { createTestStore } = await import('@/store/slices/store-test-helpers')
  return { useAppStore: createTestStore() }
})
vi.mock('./use-agent-hub-live-pty', () => ({ useAgentHubLivePty: () => 'pty-1' }))
vi.mock('../native-chat/use-native-chat-can-send', () => ({ useNativeChatCanSend: () => true }))
vi.mock('../native-chat/use-native-chat-interactive-send', () => ({
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

function renderApprovalCard(agentType: string) {
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
    interactivePrompt: JSON.stringify({ approval: { tool: 'bash', summary: 'pnpm test' } })
  }
  useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: entry } })
  const [thread] = makeThreads(
    buildActivityEvents({
      agentStatusByPaneKey: { [PANE_KEY]: entry },
      retainedAgentsByPaneKey: {},
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
])('allows a %s approval once with the key its prompt expects', (agentType, key) => {
  const control = renderApprovalCard(agentType)
  afterGuard()

  expect(control.current?.chooseOption(0)).toBe(true)
  expect(send.sendRaw).toHaveBeenCalledWith(key)
})

it('ignores a number key pressed as the card appears', () => {
  const control = renderApprovalCard('claude')

  expect(control.current?.chooseOption(0)).toBe(false)
  expect(send.sendRaw).not.toHaveBeenCalled()
  afterGuard()
  expect(control.current?.chooseOption(0)).toBe(true)
})

it('denies with a single Escape, not the Stop sequence', () => {
  const control = renderApprovalCard('opencode')
  afterGuard()

  // The deny option first asks for an instruction; an empty reply denies plainly.
  let chose = false
  act(() => {
    chose = control.current?.chooseOption(1) ?? false
  })
  expect(chose).toBe(true)
  const form = container.querySelector('form')
  expect(form).not.toBeNull()
  act(() => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  expect(send.cancelAsk).toHaveBeenCalledTimes(1)
  expect(send.cancel).not.toHaveBeenCalled()
})

it('keeps a reopened card answered while its answer is on the way, then allows a retry', () => {
  const first = renderApprovalCard('claude')
  afterGuard()
  expect(first.current?.chooseOption(0)).toBe(true)

  act(() => root.render(<div />))
  const reopened = renderApprovalCard('claude')
  afterGuard()
  expect(reopened.current?.chooseOption(0)).toBe(false)
  expect(send.sendRaw).toHaveBeenCalledTimes(1)

  act(() => {
    vi.advanceTimersByTime(AGENT_HUB_ANSWER_HOLD_MS)
  })
  act(() => root.render(<div />))
  const later = renderApprovalCard('claude')
  afterGuard()
  expect(later.current?.chooseOption(0)).toBe(true)
  expect(send.sendRaw).toHaveBeenCalledTimes(2)
})

it('hides from the Inbox without answering, and keeps the agent waiting', () => {
  renderApprovalCard('claude')
  afterGuard()
  const hide = container.querySelector<HTMLButtonElement>('[data-agent-hub-card-hide]')
  act(() => hide?.click())
  expect(isAgentHubCardDismissed(agentHubThreadCardKey(lastThread), 'inbox')).toBe(true)
  expect(send.sendRaw).not.toHaveBeenCalled()
  expect(send.cancelAsk).not.toHaveBeenCalled()
})
