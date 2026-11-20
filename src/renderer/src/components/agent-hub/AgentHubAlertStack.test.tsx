/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render } from '@testing-library/react'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import { PANE_KEY, PANE_KEY_2 } from './agent-hub-activity-test-fixtures'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { AgentHubAlertStack } from './AgentHubAlertStack'
import type * as QuickAnswer from './use-agent-hub-quick-answer'
import type { AgentHubQuickAnswer } from './use-agent-hub-quick-answer'

type QuickAnswerStub = Pick<
  AgentHubQuickAnswer,
  'question' | 'options' | 'chosen' | 'canAnswer' | 'choose' | 'chooseByKey'
>
const quick = vi.hoisted(() => {
  const state: { answer: QuickAnswerStub | null } = { answer: null }
  return state
})
vi.mock('./use-agent-hub-quick-answer', async (original) => ({
  ...(await original<typeof QuickAnswer>()),
  useAgentHubQuickAnswer: (): QuickAnswerStub =>
    quick.answer ?? {
      question: null,
      options: [],
      chosen: null,
      canAnswer: false,
      choose: () => false,
      chooseByKey: () => false
    }
}))

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: {},
      keybindings: {},
      activeView: 'terminal',
      activeWorktreeId: null
    }))
  }
})
afterEach(() => {
  cleanup()
  quick.answer = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('marks an alert as current only while its workspace is the open one', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    }
  )
  const thread = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1000 }])[0]
  render(
    <TooltipProvider>
      <AgentHubAlertStack
        alerts={[{ id: 'a', kind: 'done', thread }]}
        anchorRef={{ current: document.body }}
        side="top"
        locationOf={() => ({ group: null, project: 'Project', workspace: null })}
        onOpen={vi.fn()}
        onPopout={vi.fn()}
        onJump={vi.fn()}
        onDismiss={vi.fn()}
      />
    </TooltipProvider>
  )
  const content = (): string | null | undefined =>
    document.querySelector('[data-agent-hub-alert] [data-current]')?.getAttribute('data-current')
  expect(content()).toBe('false')
  act(() => useAppStore.setState({ activeWorktreeId: thread.worktree.id }))
  expect(content()).toBe('true')
  act(() => useAppStore.setState({ activeView: 'tasks' }))
  expect(content()).toBe('false')
})

it('answers the newest question from its bubble by click or number key, then lets it go', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    }
  )
  const choose = vi.fn((_index: number, onDeliverySettled?: (delivered: boolean) => void) => {
    onDeliverySettled?.(true)
    return true
  })
  quick.answer = {
    options: [
      { id: 'a', label: 'Add delete', recommended: true },
      { id: 'b', label: 'Keep as is' }
    ],
    chosen: null,
    canAnswer: true,
    choose,
    chooseByKey: choose,
    question: 'Keep it?'
  }
  const threads = agentHubThreadsFor([
    { paneKey: PANE_KEY, state: 'waiting', at: 1000 },
    { paneKey: PANE_KEY_2, state: 'waiting', at: 900 }
  ])
  const thread = threads.find((t) => t.paneKey === PANE_KEY)
  const older = threads.find((t) => t.paneKey === PANE_KEY_2)
  if (!thread || !older) {
    throw new Error('expected both threads')
  }
  const onDismiss = vi.fn()
  const onOpen = vi.fn()
  render(
    <TooltipProvider>
      <AgentHubAlertStack
        alerts={[
          { id: 'older', kind: 'ask', thread: older },
          { id: 'q', kind: 'ask', thread }
        ]}
        anchorRef={{ current: document.body }}
        side="top"
        locationOf={() => ({ group: null, project: 'Project', workspace: null })}
        onOpen={onOpen}
        onPopout={vi.fn()}
        onJump={vi.fn()}
        onDismiss={onDismiss}
        answerKeys
      />
    </TooltipProvider>
  )
  const chips = document.querySelectorAll(
    '[data-agent-hub-alert="ask"]:last-child [data-agent-hub-alert-options] button'
  )
  expect([...chips].map((chip) => chip.textContent)).toEqual(['1Add delete', '2Keep as is'])

  // Typing in a terminal keeps its digits.
  const terminal = document.createElement('div')
  terminal.className = 'xterm'
  const input = document.createElement('textarea')
  terminal.append(input)
  document.body.append(terminal)
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
  expect(choose).not.toHaveBeenCalled()

  // A focused button keeps its keys too.
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  button.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
  expect(choose).not.toHaveBeenCalled()

  // Only the newest bubble answers to the keys, once.
  button.blur()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
  expect(choose).toHaveBeenCalledTimes(1)
  expect(choose).toHaveBeenCalledWith(1, expect.any(Function))
  act(() => vi.advanceTimersByTime(1000))
  expect(onDismiss).toHaveBeenCalledWith('q')
  expect(onDismiss).not.toHaveBeenCalledWith('older')

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'q' }))
})
