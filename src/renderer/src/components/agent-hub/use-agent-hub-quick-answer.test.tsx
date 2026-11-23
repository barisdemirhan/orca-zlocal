import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { NativeChatInteractiveSend } from '../native-chat/session/terminal/send/use-native-chat-interactive-send'
import { buildActivityEvents } from '../activity/events/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktree,
  PANE_KEY
} from './agent-hub-activity-test-fixtures'
import {
  AGENT_HUB_ANSWER_HOLD_MS,
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
  sendAnswer: vi.fn<NativeChatInteractiveSend['sendAnswer']>(() => ({ settleAfterMs: 800 })),
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
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../terminal/workspace-mounting/background-terminal-worktree-mount', () => ({
  requestBackgroundTerminalWorktreeMount: vi.fn()
}))
vi.mock('./use-agent-hub-live-pty', () => ({ useAgentHubLivePty: () => 'pty-1' }))
vi.mock('../native-chat/host-access/use-native-chat-can-send', () => ({
  useNativeChatCanSend: () => true
}))
vi.mock('../native-chat/session/terminal/send/use-native-chat-interactive-send', () => ({
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
  return thread
}

beforeEach(() => {
  Object.values(send).forEach((fn) => fn.mockReset())
  send.sendAnswer.mockReturnValue({ settleAfterMs: 800 })
  send.sendRawVerified.mockResolvedValue(true)
  send.cancelAsk.mockResolvedValue(true)
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

it('hands the answer back when its delivery never settles', () => {
  vi.useFakeTimers()
  const thread = threadWith(
    JSON.stringify({ questions: [{ question: 'Keep it?', options: [{ label: 'Yes' }] }] })
  )
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  act(() => {
    hook.result.current.choose(0)
  })
  expect(hook.result.current.pending).toBe(true)
  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(toast.error).toHaveBeenCalledOnce()
  expect(send.cancelPending).toHaveBeenCalledOnce()
  expect(readAnsweredAgentHubCard(agentHubThreadCardKey(thread))).toBeNull()
  let again = false
  act(() => {
    again = hook.result.current.choose(0)
  })
  expect(again).toBe(true)
  expect(send.sendAnswer).toHaveBeenCalledTimes(2)
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

it('allows an approval once with the agent key and denies with Esc', async () => {
  const thread = threadWith(JSON.stringify({ approval: { tool: 'bash', summary: 'pnpm test' } }))
  const allow = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  expect(allow.result.current.options.map((option) => option.deny ?? false)).toEqual([false, true])
  await act(async () => {
    allow.result.current.choose(0)
  })
  expect(send.sendRawVerified).toHaveBeenCalledWith('1')

  resetAgentHubAnsweredCardsForTest()
  const deny = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  await act(async () => {
    deny.result.current.choose(1)
  })
  expect(send.cancelAsk).toHaveBeenCalledOnce()
})

it.each(['allow', 'deny'] as const)(
  'reopens an approval when its %s delivery is rejected',
  async (decision) => {
    const thread = threadWith(JSON.stringify({ approval: { tool: 'bash', summary: 'pnpm test' } }))
    if (decision === 'allow') {
      send.sendRawVerified.mockResolvedValueOnce(false)
    } else {
      send.cancelAsk.mockResolvedValueOnce(false)
    }
    const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
    await act(async () => {
      expect(hook.result.current.choose(decision === 'allow' ? 0 : 1)).toBe(true)
    })
    expect(hook.result.current.chosen).toBeNull()
    expect(readAnsweredAgentHubCard(agentHubThreadCardKey(thread))).toBeNull()
  }
)

it('waits for the host acknowledgement before reporting an answer and permits retry after failure', async () => {
  const thread = threadWith(JSON.stringify({ approval: { tool: 'bash', summary: 'pnpm test' } }))
  let finish: (delivered: boolean) => void = () => {
    throw new Error('Delivery not started')
  }
  send.sendRawVerified.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve
    })
  )
  const settled = vi.fn()
  const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
  await act(async () => {
    expect(hook.result.current.choose(0, settled)).toBe(true)
  })
  expect(hook.result.current.pending).toBe(true)
  expect(settled).not.toHaveBeenCalled()
  await act(async () => finish(false))
  expect(hook.result.current.pending).toBe(false)
  expect(hook.result.current.chosen).toBeNull()
  expect(settled).toHaveBeenLastCalledWith(false)
  await act(async () => {
    expect(hook.result.current.choose(0, settled)).toBe(true)
  })
  expect(settled).toHaveBeenLastCalledWith(true)
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

it('shares a full-card answer before delivery so a competing surface cannot write twice', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000)
  const thread = threadWith(
    JSON.stringify({
      questions: [
        { question: 'A?', options: [{ label: 'x' }] },
        { question: 'B?', options: [{ label: 'y' }] }
      ]
    })
  )
  let finish: ((delivered: boolean) => void) | undefined
  send.sendAnswer.mockImplementation((_prompt, _selections, onSettled) => {
    finish = onSettled
    return { settleAfterMs: 800 }
  })
  const hook = renderHook(() => ({
    pane: useAgentHubQuickAnswer(quickAnswerTargetOf(thread)),
    hub: useAgentHubQuickAnswer(quickAnswerTargetOf(thread))
  }))
  const card = hook.result.current.pane.card
  if (card?.kind !== 'question') {
    throw new Error('No question card')
  }
  const selections = [{ indices: [0] }, { indices: [0] }]
  const settled = vi.fn()
  act(() => {
    expect(
      hook.result.current.pane.send.sendAnswer(card.prompt, selections, settled).settleAfterMs
    ).toBe(800)
    expect(hook.result.current.hub.send.sendAnswer(card.prompt, selections).settleAfterMs).toBe(0)
  })
  expect(hook.result.current.hub.pending).toBe(true)
  expect(hook.result.current.hub.chosen).toBe(-1)
  expect(send.sendAnswer).toHaveBeenCalledOnce()
  vi.setSystemTime(1_000 + AGENT_HUB_ANSWER_HOLD_MS)
  hook.rerender()
  expect(hook.result.current.hub.pending).toBe(true)
  expect(hook.result.current.hub.send.sendAnswer(card.prompt, selections).settleAfterMs).toBe(0)
  act(() => finish?.(true))
  expect(settled).toHaveBeenCalledWith(true)
  expect(hook.result.current.hub.pending).toBe(false)
  expect(hook.result.current.hub.send.sendAnswer(card.prompt, selections).settleAfterMs).toBe(0)
  expect(send.sendAnswer).toHaveBeenCalledOnce()
})

it.each(['not-started', 'refused'] as const)(
  'makes a full-card answer retryable on every surface after delivery is %s',
  (failure) => {
    const thread = threadWith(
      JSON.stringify({
        questions: [
          { question: 'Pick several', multiSelect: true, options: [{ label: 'x' }, { label: 'y' }] }
        ]
      })
    )
    let finish: ((delivered: boolean) => void) | undefined
    send.sendAnswer.mockImplementationOnce((_prompt, _selections, onSettled) => {
      finish = onSettled
      return { settleAfterMs: failure === 'not-started' ? 0 : 800 }
    })
    const hook = renderHook(() => useAgentHubQuickAnswer(quickAnswerTargetOf(thread)))
    const card = hook.result.current.card
    if (card?.kind !== 'question') {
      throw new Error('No question card')
    }
    act(() => {
      hook.result.current.send.sendAnswer(card.prompt, [{ indices: [0, 1] }])
    })
    if (failure === 'refused') {
      act(() => finish?.(false))
    }
    expect(hook.result.current.chosen).toBeNull()
    expect(hook.result.current.pending).toBe(false)
    act(() => {
      hook.result.current.send.sendAnswer(card.prompt, [{ indices: [1] }])
    })
    expect(send.sendAnswer).toHaveBeenCalledTimes(2)
    expect(hook.result.current.pending).toBe(true)
  }
)

it('shares a full-card cancellation and allows a retry when the host refuses it', async () => {
  const thread = threadWith(
    JSON.stringify({
      questions: [
        { question: 'Pick several', multiSelect: true, options: [{ label: 'x' }, { label: 'y' }] }
      ]
    })
  )
  let finish: (delivered: boolean) => void = () => {}
  send.cancelAsk.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve
    })
  )
  const hook = renderHook(() => ({
    pane: useAgentHubQuickAnswer(quickAnswerTargetOf(thread)),
    hub: useAgentHubQuickAnswer(quickAnswerTargetOf(thread))
  }))
  let delivery: Promise<boolean> = Promise.resolve(false)
  act(() => {
    delivery = hook.result.current.pane.send.cancelAsk()
  })
  expect(hook.result.current.hub.pending).toBe(true)
  expect(await hook.result.current.hub.send.cancelAsk()).toBe(false)
  expect(send.cancelAsk).toHaveBeenCalledOnce()
  await act(async () => {
    finish(false)
  })
  expect(await delivery).toBe(false)
  expect(hook.result.current.hub.chosen).toBeNull()
  expect(hook.result.current.hub.pending).toBe(false)
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
