// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubOrbPanel, agentHubOrbAnchorRect } from './AgentHubOrbPanel'
import {
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import type { AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'

const mocks = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    open: vi.fn(),
    close: vi.fn(),
    list: vi.fn(),
    listeners,
    feed: {
      activate: () => () => {},
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }
  }
})
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      dictationState: 'idle',
      unifiedTabsByWorktree: {},
      keybindings: {}
    }))
  }
})
vi.mock('@/lib/structured-agent-session-launch-label', () => ({
  structuredAgentLabel: (id: string) => (id === 'codex' ? 'Codex' : 'Claude')
}))
vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  findStructuredAgentSessionTab: (_tabs: unknown, params: { sessionId: string }) => ({
    id: `tab-${params.sessionId}`
  })
}))
vi.mock('@/runtime/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => mocks.feed
}))
const conversations: AgentHubOrbConversation[] = [
  {
    sessionId: 'current',
    agent: 'codex',
    model: 'gpt-model',
    title: 'Mic worker',
    startedAt: Date.now(),
    lastActiveAt: Date.now()
  },
  { sessionId: 'past', agent: 'claude', title: 'Old question', startedAt: 1000, lastActiveAt: 1000 }
]
beforeEach(() => {
  vi.clearAllMocks()
  closeAgentHubOrbPanel()
  useAppStore.setState({ dictationState: 'idle' })
  mocks.list.mockResolvedValue(conversations)
  mocks.open.mockImplementation(async (params?: { resume?: { sessionId: string } }) => ({
    sessionId: params?.resume?.sessionId ?? 'new',
    resumed: Boolean(params?.resume)
  }))
  mocks.close.mockResolvedValue(undefined)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { agentHub: { orb: { list: mocks.list, open: mocks.open, close: mocks.close } } }
  })
})
afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
  mocks.listeners.clear()
})
function show() {
  showAgentHubOrbPanel({ sessionId: 'current', tabId: 'tab-current', resumed: false })
  return render(
    <TooltipProvider>
      <AgentHubOrbPanel
        anchorRef={{ current: null }}
        side="right"
        docked
        hidden={false}
        requestPresentationOf={vi.fn()}
      />
    </TooltipProvider>
  )
}

it('opens with the conversation model and title and places an unanchored panel above the bottom centre', async () => {
  show()
  expect(await screen.findByText('Codex · gpt-model')).toBeTruthy()
  expect(screen.getByText(/Mic worker ·/)).toBeTruthy()
  const rect = agentHubOrbAnchorRect(null)
  expect(rect.x).toBe(window.innerWidth / 2)
  expect(rect.y).toBe(window.innerHeight - 40)
  expect(document.querySelector('[data-agent-hub-orb-panel]')?.getAttribute('data-side')).toBe(
    'top'
  )
  act(() => mocks.listeners.forEach((listener) => listener()))
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: /^Close\b/ }))
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  expect(mocks.close).not.toHaveBeenCalled()
})

it('reopens from history with one resume call and creates New by closing then opening', async () => {
  show()
  await screen.findByText('Codex · gpt-model')
  fireEvent.click(screen.getByRole('button', { name: 'Past conversations' }))
  fireEvent.click(screen.getByRole('button', { name: /Old question/ }))
  await screen.findByText('Claude · Agent default')
  expect(mocks.open).toHaveBeenCalledWith({ resume: { sessionId: 'past' } })
  expect(mocks.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Past conversations' }))
  fireEvent.click(screen.getByRole('button', { name: 'New' }))
  await waitFor(() => expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('new'))
  expect(mocks.close).toHaveBeenCalledOnce()
  expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.open.mock.invocationCallOrder[1]
  )
})

it('Escape cancels an active dictation and leaves the panel open, then closes it when idle', async () => {
  const actions: unknown[] = []
  const listener = (event: Event) => {
    if (event instanceof CustomEvent) {
      actions.push(event.detail)
    }
  }
  document.addEventListener(DICTATION_CONTROL_EVENT, listener)
  show()
  await screen.findByText('Codex · gpt-model')
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
    key: 'Escape'
  })
  expect(actions).toEqual(['cancel'])
  expect(useAgentHubOrbPanel.getState().session).not.toBeNull()
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
    key: 'Escape'
  })
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  document.removeEventListener(DICTATION_CONTROL_EVENT, listener)
})

it('reopening leaves another pane recording and cancels only the Orb recording it switches away from', async () => {
  const actions: unknown[] = []
  const listener = (event: Event) => {
    if (event instanceof CustomEvent) {
      actions.push(event.detail)
    }
  }
  const stopTracking = trackAgentHubDictationOrigin()
  document.addEventListener(DICTATION_CONTROL_EVENT, listener)
  const terminal = document.createElement('div')
  terminal.dataset.terminalTabId = 'other-worker'
  const other = document.createElement('textarea')
  other.className = 'xterm-helper-textarea'
  terminal.append(other)
  document.body.append(terminal)
  try {
    other.focus()
    act(() => useAppStore.setState({ dictationState: 'listening' }))
    show()
    await screen.findByText('Codex · gpt-model')
    fireEvent.click(screen.getByRole('button', { name: 'Past conversations' }))
    fireEvent.click(screen.getByRole('button', { name: /Old question/ }))
    await screen.findByText('Claude · Agent default')
    expect(actions).toEqual([])
    expect(useAppStore.getState().dictationState).toBe('listening')
    act(() => useAppStore.setState({ dictationState: 'idle' }))
    const slot = document.querySelector('[data-agent-hub-orb-chat-tab-id="tab-past"]')
    if (!(slot instanceof HTMLElement)) {
      throw new Error('Missing Orb composer slot')
    }
    const composer = document.createElement('textarea')
    slot.append(composer)
    composer.focus()
    act(() => useAppStore.setState({ dictationState: 'listening' }))
    fireEvent.click(screen.getByRole('button', { name: 'Past conversations' }))
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    await waitFor(() => expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('new'))
    expect(actions).toEqual(['cancel'])
  } finally {
    act(() => useAppStore.setState({ dictationState: 'idle' }))
    stopTracking()
    terminal.remove()
    document.removeEventListener(DICTATION_CONTROL_EVENT, listener)
  }
})
