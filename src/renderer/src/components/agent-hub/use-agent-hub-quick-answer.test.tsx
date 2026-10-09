/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { buildActivityEvents } from '../activity/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  agentHubThreadCardKey,
  readAnsweredAgentHubCard,
  resetAgentHubAnsweredCardsForTest
} from './agent-hub-answered-cards'
import {
  AGENT_HUB_CARD_KEY_GUARD_MS,
  quickAnswerTargetOf,
  useAgentHubQuickAnswer
} from './use-agent-hub-quick-answer'

const send = vi.hoisted(() => ({
  sendAnswer: vi.fn(() => ({ settleAfterMs: 800 })),
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

function threadWith(interactivePrompt: string) {
  const worktree = makeWorktree()
  const repo = makeRepo()
  const tab = makeTabWithIds('tab-1', worktree.id)
  const entry: AgentStatusEntry = {
    state: 'waiting',
    prompt: 'Decide',
    updatedAt: 1_000,
    stateStartedAt: 1_000,
    paneKey: PANE_KEY,
    terminalTitle: 'Agent',
    stateHistory: [],
    agentType: 'claude',
    interactivePrompt
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
  return thread
}

beforeEach(() => {
  Object.values(send).forEach((fn) => fn.mockClear())
  resetAgentHubAnsweredCardsForTest()
})
afterEach(() => {
  resetAgentHubAnsweredCardsForTest()
  vi.useRealTimers()
})

it('answers a single question with its option and shares the answer with the hub card', () => {
  const thread = threadWith(
    JSON.stringify({
      questions: [
        {
          question: 'Keep it?',
          options: [{ label: 'Add delete (Recommended)' }, { label: 'Keep as is' }]
        }
      ]
    })
  )
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  expect(hook.result.current.options.map((option) => option.label)).toEqual([
    'Add delete',
    'Keep as is'
  ])
  expect(hook.result.current.options[0]?.recommended).toBe(true)

  let chosen = false
  act(() => {
    chosen = hook.result.current.choose(1)
  })
  expect(chosen).toBe(true)
  expect(send.sendAnswer).toHaveBeenCalledWith(
    expect.anything(),
    [{ indices: [1] }],
    expect.any(Function)
  )
  expect(hook.result.current.chosen).toBe(1)
  expect(readAnsweredAgentHubCard(agentHubThreadCardKey(thread))).toBe(1)
  // A second answer is refused while the first stands.
  expect(hook.result.current.choose(0)).toBe(false)
})

it('hands the answer back when nothing could be sent', () => {
  send.sendAnswer.mockReturnValueOnce({ settleAfterMs: 0 })
  const thread = threadWith(
    JSON.stringify({ questions: [{ question: 'Keep it?', options: [{ label: 'Yes' }] }] })
  )
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  let chosen = true
  act(() => {
    chosen = hook.result.current.choose(0)
  })
  expect(chosen).toBe(false)
  expect(hook.result.current.chosen).toBeNull()
})

it('ignores a number key pressed as the surface appears, and takes it after the guard', () => {
  vi.useFakeTimers({ toFake: ['performance', 'Date'] })
  const thread = threadWith(
    JSON.stringify({ questions: [{ question: 'Keep it?', options: [{ label: 'Yes' }] }] })
  )
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  expect(hook.result.current.chooseByKey(0)).toBe(false)
  expect(send.sendAnswer).not.toHaveBeenCalled()
  vi.advanceTimersByTime(AGENT_HUB_CARD_KEY_GUARD_MS)
  let chosen = false
  act(() => {
    chosen = hook.result.current.chooseByKey(0)
  })
  expect(chosen).toBe(true)
})

it('allows an approval once with the agent key and denies with Esc', () => {
  const thread = threadWith(JSON.stringify({ approval: { tool: 'bash', summary: 'pnpm test' } }))
  const allow = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  expect(allow.result.current.options.map((option) => option.deny ?? false)).toEqual([false, true])
  act(() => {
    allow.result.current.choose(0)
  })
  expect(send.sendRaw).toHaveBeenCalledWith('1')

  resetAgentHubAnsweredCardsForTest()
  const deny = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  act(() => {
    deny.result.current.choose(1)
  })
  expect(send.cancelAsk).toHaveBeenCalledOnce()
})

it('offers no quick options for a prompt with several questions', () => {
  const thread = threadWith(
    JSON.stringify({
      questions: [
        { question: 'A?', options: [{ label: 'x' }] },
        { question: 'B?', options: [{ label: 'y' }] }
      ]
    })
  )
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  expect(hook.result.current.options).toEqual([])
  expect(hook.result.current.reply('anything')).toBe(false)
})

it("sends a reply in the user's words for a single question", () => {
  const thread = threadWith(
    JSON.stringify({ questions: [{ question: 'Keep it?', options: [{ label: 'Yes' }] }] })
  )
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  expect(hook.result.current.question).toBe('Keep it?')
  let sent = false
  act(() => {
    sent = hook.result.current.reply('Only on Fridays')
  })
  expect(sent).toBe(true)
  expect(send.sendAnswer).toHaveBeenCalledWith(
    expect.anything(),
    [{ indices: [], other: 'Only on Fridays' }],
    expect.any(Function)
  )
  expect(hook.result.current.chosen).toBe(-1)
})
