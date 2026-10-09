/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render } from '@testing-library/react'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { AgentHubAlertStack } from './AgentHubAlertStack'
import type { AgentHubQuickAnswer } from './use-agent-hub-quick-answer'

const quick = vi.hoisted(() => {
  const state: { answer: AgentHubQuickAnswer | null } = { answer: null }
  return state
})
vi.mock('./use-agent-hub-quick-answer', () => ({
  useAgentHubQuickAnswer: () =>
    quick.answer ?? { options: [], chosen: null, canAnswer: false, choose: () => false }
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
afterEach(cleanup)

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
  const choose = vi.fn(() => true)
  quick.answer = {
    options: [
      { id: 'a', label: 'Add delete', recommended: true },
      { id: 'b', label: 'Keep as is' }
    ],
    chosen: null,
    canAnswer: true,
    choose
  }
  const thread = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'waiting', at: 1000 }])[0]
  const onDismiss = vi.fn()
  const onOpen = vi.fn()
  render(
    <TooltipProvider>
      <AgentHubAlertStack
        alerts={[{ id: 'q', kind: 'ask', thread }]}
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
  const chips = document.querySelectorAll('[data-agent-hub-alert-options] button')
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

  input.blur()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }))
  expect(choose).toHaveBeenCalledWith(1)
  act(() => vi.advanceTimersByTime(1000))
  expect(onDismiss).toHaveBeenCalledWith('q')

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'q' }))
  quick.answer = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
