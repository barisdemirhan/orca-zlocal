// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
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
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { AgentHubOrbSession, AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'
import { RetainedPaneHost } from '../tab-group/RetainedPaneHost'
import { NativeChatSessionOptionPickers } from '../native-chat/NativeChatSessionOptionPickers'
import type { SessionOptionDescriptor } from '../../../../shared/native-chat-session-options'

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
  useAppStore.setState({
    dictationState: 'idle',
    settings: createGlobalSettingsFixture({ agentHubOrbAgent: 'claude' })
  })
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

it('keeps the retained chat and its model picker open until an actual outside interaction', async () => {
  const user = userEvent.setup()
  const setOption = vi.fn().mockResolvedValue(undefined)
  const model: SessionOptionDescriptor = {
    id: 'model',
    label: 'Model',
    category: 'model',
    kind: {
      type: 'select',
      currentValue: 'opus',
      choices: [
        { value: 'opus', label: 'Opus 4.8' },
        { value: 'sonnet', label: 'Sonnet 5' }
      ]
    },
    valueSource: 'applied',
    transport: 'catalog',
    settable: true
  }
  function RetainedChat() {
    const destination = useAgentHubOrbPanel((state) => state.destination)
    const draftRef = useRef<HTMLInputElement>(null)
    return (
      <RetainedPaneHost
        groupId={undefined}
        isVisible={false}
        retainContent
        destination={destination}
      >
        <input ref={draftRef} aria-label="Chat draft" defaultValue="unsent draft" />
        <NativeChatSessionOptionPickers
          snapshot={[model]}
          isWorking={false}
          focusComposer={() => draftRef.current?.focus()}
          surface={{
            getSnapshot: () => [model],
            subscribe: () => () => {},
            setOption,
            invokeAction: vi.fn()
          }}
        />
      </RetainedPaneHost>
    )
  }
  showAgentHubOrbPanel({ sessionId: 'current', tabId: 'tab-current', resumed: false })
  render(
    <TooltipProvider>
      <AgentHubOrbPanel
        anchorRef={{ current: null }}
        side="top"
        docked
        hidden={false}
        requestPresentationOf={vi.fn()}
      />
      <RetainedChat />
      <button>Outside</button>
    </TooltipProvider>
  )
  const draft = await screen.findByRole('textbox', { name: 'Chat draft' })
  const trigger = screen.getByRole('button', { name: /Model.*Opus/ })
  await user.click(trigger)
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox')))
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  expect(useAgentHubOrbPanel.getState().destination?.contains(trigger)).toBe(true)
  const option = screen.getByRole('option', { name: /Sonnet 5/ })
  let deferredOutsideSeen = false
  option.addEventListener('dismissableLayer.pointerDownOutside', () => {
    if (!trigger.hasAttribute('aria-controls')) {
      deferredOutsideSeen = true
    }
  })
  // Electron clears this link on selection before Radix dispatches its deferred outside event.
  option.addEventListener('click', () => trigger.removeAttribute('aria-controls'), { once: true })
  await user.click(option)
  await waitFor(() => expect(deferredOutsideSeen).toBe(true))
  await waitFor(() => expect(setOption).toHaveBeenCalledWith('model', 'sonnet'))
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  expect(document.querySelector('[data-agent-hub-orb-panel]')).not.toBeNull()
  expect(screen.getByRole('textbox', { name: 'Chat draft' })).toBe(draft)
  await waitFor(() => expect(document.activeElement).toBe(draft))
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  await waitFor(() => expect(useAgentHubOrbPanel.getState().session).toBeNull())
})

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

it('retries a failed New action without misreporting it as a history load failure', async () => {
  show()
  await screen.findByText('Codex · gpt-model')
  fireEvent.click(screen.getByRole('button', { name: 'Past conversations' }))
  mocks.close.mockRejectedValueOnce({
    code: 'invalid_argument',
    message: 'Orb is still working. Wait for it to finish.'
  })
  fireEvent.click(screen.getByRole('button', { name: 'New' }))
  expect(await screen.findByText('Orb is still working. Wait for it to finish.')).toBeTruthy()
  expect(screen.queryByText('Could not load conversations. Try again.')).toBeNull()
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('new'))
  expect(mocks.close).toHaveBeenCalledTimes(2)
})

it('applies debounced saved settings serially to an open Orb and does not reopen a closed panel', async () => {
  show()
  await screen.findByText('Codex · gpt-model')
  expect(mocks.open).not.toHaveBeenCalled()
  let finishFirst: ((session: AgentHubOrbSession) => void) | undefined
  let finishLatest: ((session: AgentHubOrbSession) => void) | undefined
  mocks.open.mockImplementationOnce(
    () =>
      new Promise<AgentHubOrbSession>((resolve) => {
        finishFirst = resolve
      })
  )
  mocks.open.mockImplementationOnce(
    () =>
      new Promise<AgentHubOrbSession>((resolve) => {
        finishLatest = resolve
      })
  )
  act(() =>
    useAppStore.setState({ settings: createGlobalSettingsFixture({ agentHubOrbAgent: 'codex' }) })
  )
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1))
  act(() =>
    useAppStore.setState({
      settings: createGlobalSettingsFixture({
        agentHubOrbAgent: 'codex',
        agentHubOrbModel: 'draft-model'
      })
    })
  )
  act(() =>
    useAppStore.setState({
      settings: createGlobalSettingsFixture({
        agentHubOrbAgent: 'codex',
        agentHubOrbModel: 'final-model'
      })
    })
  )
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
  })
  expect(mocks.open).toHaveBeenCalledTimes(1)
  await act(async () => finishFirst?.({ sessionId: 'intermediate', resumed: false }))
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(2))
  act(() => closeAgentHubOrbPanel())
  await act(async () => finishLatest?.({ sessionId: 'latest', resumed: false }))
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  expect(useAppStore.getState().settings?.agentHubOrbModel).toBe('final-model')
})
