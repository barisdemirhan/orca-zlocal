// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { createGlobalSettingsFixture } from '../../../../shared/settings/global-settings-test-fixture'
import type { AgentHubOrbSession, AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'
import { RetainedPaneHost } from '../tab-group/retained-pane/RetainedPaneHost'
import { NativeChatSessionOptionPickers } from '../native-chat/session/options/controls/NativeChatSessionOptionPickers'
import type { SessionOptionDescriptor } from '../../../../shared/native-chat/input/native-chat-session-options'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubRequest } from '../../../../shared/agent-hub-requests'
import { applyAgentHubDelivery, clearAgentHubRequestHost } from './agent-hub-requests-store'
import { registerAgentHubRequestResponder } from './agent-hub-request-answer'
import { orbAsk } from './agent-hub-orb-test-fixtures'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session/agent-session-wire'

const mocks = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const voice: AgentHubOrbVoiceValue = {
    capability: 'unsupported' as const,
    canStart: false,
    connection: 'off' as const,
    input: 'listening' as const,
    output: 'silent' as const,
    outputMuted: false,
    textMode: true,
    startLive: vi.fn(async () => {}),
    stopLive: vi.fn(async () => {}),
    muteInput: vi.fn(),
    muteOutput: vi.fn(),
    stopSpeaking: vi.fn(),
    switchToText: vi.fn(async () => {}),
    prepareDictation: vi.fn(async () => false)
  }
  return {
    open: vi.fn(),
    close: vi.fn(),
    list: vi.fn(),
    voice,
    listeners,
    feed: {
      getSnapshot: vi.fn(() => new Map<string, AgentSessionStatusSummary>()),
      activate: () => () => {},
      getSessionObservation: () => 'unverifiable' as const,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      subscribeSession: (_sessionId: string, listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }
  }
})
vi.mock('./use-agent-hub-orb-voice', () => ({ useAgentHubOrbVoice: () => mocks.voice }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { createGlobalSettingsFixture } =
    await import('../../../../shared/settings/global-settings-test-fixture')
  const useAppStore = create(() => ({
    dictationState: 'idle',
    unifiedTabsByWorktree: {},
    keybindings: {},
    updateSettings: vi.fn((updates: Partial<GlobalSettings>) => {
      useAppStore.setState((state) => ({ settings: { ...state.settings, ...updates } }))
    }),
    settings: createGlobalSettingsFixture()
  }))
  return {
    useAppStore
  }
})
vi.mock('./use-agent-hub-orb-options', () => ({
  useAgentHubOrbOptions: (agent: string) => ({
    agents: [
      { id: 'claude', label: 'Claude' },
      { id: 'codex', label: 'Codex' }
    ],
    models: agent === 'codex' ? [{ id: 'next-model', label: 'Next model' }] : [],
    loading: false,
    refreshModels: () => {}
  })
}))
vi.mock('@/lib/agent-session/launch/structured-agent-session-launch-label', () => ({
  structuredAgentLabel: (id: string) => (id === 'codex' ? 'Codex' : 'Claude')
}))
vi.mock('@/lib/agent-session/structured-agent-session-tab-activation', () => ({
  findStructuredAgentSessionTab: (_tabs: unknown, params: { sessionId: string }) => ({
    id: `tab-${params.sessionId}`
  })
}))
vi.mock('@/runtime/native-chat/status/structured-agent-session-status-feed', () => ({
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
  mocks.voice.connection = 'off'
  mocks.feed.getSnapshot.mockReturnValue(new Map())
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
    value: {
      agentHub: { orb: { list: mocks.list, open: mocks.open, close: mocks.close } },
      app: {
        getAgentHubOrbDirectory: () => Promise.resolve('/tmp/orb'),
        readAgentHubOrbIdentity: () =>
          Promise.resolve({ soul: '', user: '', memory: [], truncated: false })
      }
    }
  })
})
afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
  mocks.listeners.clear()
  clearAgentHubRequestHost('local')
  clearAgentHubRequestHost('remote')
})
const requestPresentation: AgentHubRequestPresentation = {
  title: 'Orb',
  targetTitle: 'Orb',
  target: null,
  location: { project: 'Orca', group: null, workspace: null }
}
async function openFullChat(user?: ReturnType<typeof userEvent.setup>) {
  const click = async (name: string) =>
    user
      ? user.click(screen.getByRole('button', { name }))
      : act(async () => fireEvent.click(screen.getByRole('button', { name })))
  await click('Floating window')
  await click('Open full chat')
}

async function pickOrbMenuItem(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Orb menu' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name }))
}

async function show(chat = true) {
  showAgentHubOrbPanel({ sessionId: 'current', tabId: 'tab-current', resumed: false })
  const rendered = render(
    <TooltipProvider>
      <AgentHubOrbPanel
        anchorRef={{ current: null }}
        side="right"
        docked
        hidden={false}
        requestPresentationOf={() => requestPresentation}
      />
    </TooltipProvider>
  )
  if (chat) {
    if (mocks.voice.connection === 'off') {
      await openFullChat()
    } else {
      // Live shows only its own controls, so the chat is reached through the panel state.
      act(() => useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false }))
    }
  }
  return rendered
}

it('keeps the retained chat and its model picker open until explicitly closed', async () => {
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
  await openFullChat(user)
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
  // The combined picker stays open after a model pick; only effort closes it.
  expect(document.activeElement).toBe(screen.getByRole('combobox'))
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  fireEvent.blur(window)
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  expect(screen.getByRole('textbox', { name: 'Chat draft' })).toBe(draft)
  expect(draft).toMatchObject({ value: 'unsent draft' })
  await user.click(screen.getByRole('button', { name: 'Hide Orb' }))
  await waitFor(() => expect(useAgentHubOrbPanel.getState().session).toBeNull())
})

it('opens a quiet Orb before revealing the same conversation and its model above the bottom centre', async () => {
  await show(false)
  expect(screen.getByRole('img', { name: 'Ready' })).toBeTruthy()
  expect(mocks.voice.startLive).not.toHaveBeenCalled()
  const panel = () => document.querySelector('[data-agent-hub-orb-panel]')
  expect(panel()?.hasAttribute('data-agent-hub-orb-only')).toBe(true)
  await openFullChat()
  expect(await screen.findByText('Codex · gpt-model')).toBeTruthy()
  expect(panel()?.hasAttribute('data-agent-hub-orb-only')).toBe(false)
  const rect = agentHubOrbAnchorRect(null)
  expect(rect.x).toBe(window.innerWidth / 2)
  expect(rect.y).toBe(window.innerHeight - 40)
  expect(document.querySelector('[data-agent-hub-orb-panel]')?.getAttribute('data-side')).toBe(
    'top'
  )
  mocks.feed.getSnapshot.mockReturnValue(
    new Map([
      [
        'current',
        {
          sessionId: 'current',
          workspaceId: 'floating',
          agent: 'codex',
          status: 'idle',
          latestPrompt: '',
          updatedAt: Date.now()
        }
      ]
    ])
  )
  act(() => mocks.listeners.forEach((listener) => listener()))
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Hide Orb' }))
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  expect(mocks.close).not.toHaveBeenCalled()
})

it.each(['off', 'connecting', 'live', 'stopping'] as const)(
  'keeps the Orb open across outside focus and Live %s until Escape',
  async (connection) => {
    mocks.voice.connection = connection
    const user = userEvent.setup()
    const { rerender } = await show(connection !== 'off')
    const outside = document.createElement('button')
    outside.textContent = 'Workspace'
    document.body.append(outside)
    try {
      await user.click(outside)
      expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
      expect(mocks.voice.stopLive).not.toHaveBeenCalled()
      mocks.voice.connection = 'off'
      rerender(
        <TooltipProvider>
          <AgentHubOrbPanel
            anchorRef={{ current: null }}
            side="top"
            docked
            hidden={false}
            requestPresentationOf={() => requestPresentation}
          />
        </TooltipProvider>
      )
      await user.click(outside)
      expect(document.activeElement).toBe(outside)
      fireEvent.blur(window)
      expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
      fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
        key: 'Escape'
      })
      await waitFor(() => expect(useAgentHubOrbPanel.getState().session).toBeNull())
    } finally {
      outside.remove()
    }
  }
)

it('steps the mini window back to the sphere on Escape instead of hiding Orb', async () => {
  await show(false)
  act(() => useAgentHubOrbPanel.setState({ presentation: 'mini' }))
  expect(document.querySelector('[data-agent-hub-orb-mini-window]')).toBeTruthy()
  fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
    key: 'Escape'
  })
  await waitFor(() => expect(useAgentHubOrbPanel.getState().presentation).toBe('orb'))
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  expect(document.querySelector('[data-agent-hub-orb-mini-window]')).toBeNull()
})

it('keeps an Orb approval open on Escape and still closes from the surrounding panel', async () => {
  const request: AgentHubRequest = {
    ...orbAsk('current'),
    kind: 'consent',
    operation: { kind: 'mirror', action: 'close' }
  }
  applyAgentHubDelivery('local', request)
  await show(false)
  const answer = await screen.findByRole('button', { name: 'Deny' })
  fireEvent.keyDown(answer, { key: 'Escape' })
  expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current')
  expect(screen.getByRole('button', { name: 'Deny' })).toBe(answer)
  fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
    key: 'Escape'
  })
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
})

it('reopens from history with one resume call and creates New by closing then opening', async () => {
  await show()
  await screen.findByText('Codex · gpt-model')
  await pickOrbMenuItem('Past conversations')
  fireEvent.click(screen.getByRole('button', { name: /Old question/ }))
  await screen.findByText('Claude · Agent default')
  expect(mocks.open).toHaveBeenCalledWith({ resume: { sessionId: 'past' } })
  expect(mocks.close).not.toHaveBeenCalled()
  await pickOrbMenuItem('Past conversations')
  fireEvent.click(screen.getByRole('button', { name: 'New' }))
  await waitFor(() => expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('new'))
  expect(mocks.close).toHaveBeenCalledOnce()
  expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.open.mock.invocationCallOrder[1]
  )
})

it.each(['orb', 'other'] as const)(
  'Escape cancels only its own recording when %s owns dictation',
  async (owner) => {
    const actions: unknown[] = []
    const listener = (event: Event) => {
      if (event instanceof CustomEvent) {
        actions.push(event.detail)
      }
    }
    const stopTracking = trackAgentHubDictationOrigin()
    document.addEventListener(DICTATION_CONTROL_EVENT, listener)
    await show()
    await screen.findByText('Codex · gpt-model')
    const terminal = document.createElement('div')
    terminal.dataset.terminalTabId = 'other-worker'
    const input = document.createElement('textarea')
    input.className = 'xterm-helper-textarea'
    terminal.append(input)
    const slot = document.querySelector('[data-agent-hub-orb-chat-tab-id="tab-current"]')
    if (!slot) {
      throw new Error('Missing Orb composer slot')
    }
    if (owner === 'orb') {
      slot.append(input)
    } else {
      document.body.append(terminal)
    }
    try {
      input.focus()
      act(() => useAppStore.setState({ dictationState: 'listening' }))
      fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
        key: 'Escape'
      })
      expect(actions).toEqual(owner === 'orb' ? ['cancel'] : [])
      expect(Boolean(useAgentHubOrbPanel.getState().session)).toBe(owner === 'orb')
      expect(useAppStore.getState().dictationState).toBe('listening')
      act(() => useAppStore.setState({ dictationState: 'idle' }))
      fireEvent.keyDown(document.querySelector('[data-agent-hub-orb-panel]') ?? document.body, {
        key: 'Escape'
      })
      expect(useAgentHubOrbPanel.getState().session).toBeNull()
    } finally {
      act(() => useAppStore.setState({ dictationState: 'idle' }))
      stopTracking()
      terminal.remove()
      document.removeEventListener(DICTATION_CONTROL_EVENT, listener)
    }
  }
)

it('edits the shared Orb settings without losing the retained draft or conversation model', async () => {
  function RetainedDraft(): React.JSX.Element {
    const destination = useAgentHubOrbPanel((state) => state.destination)
    return (
      <RetainedPaneHost
        groupId={undefined}
        isVisible={false}
        retainContent
        destination={destination}
      >
        <input aria-label="Chat draft" defaultValue="unfinished plan" />
      </RetainedPaneHost>
    )
  }
  mocks.open.mockResolvedValue({ sessionId: 'current', resumed: false })
  await show()
  render(<RetainedDraft />)
  await screen.findByText('Codex · gpt-model')
  const draft = screen.getByRole('textbox', { name: 'Chat draft' })
  if (!(draft instanceof HTMLInputElement)) {
    throw new Error('Expected retained chat draft')
  }
  await pickOrbMenuItem('Orb settings')
  const settings = screen.getByRole('region', { name: 'Orb settings' })
  expect(useAgentHubOrbPanel.getState().destination?.contains(draft)).toBe(true)
  expect(useAgentHubOrbPanel.getState().chatVisible).toBe(false)
  fireEvent.keyDown(within(settings).getByRole('combobox', { name: 'Agent' }), {
    key: 'ArrowDown'
  })
  fireEvent.click(await screen.findByRole('option', { name: 'Codex' }))
  fireEvent.keyDown(within(settings).getByRole('combobox', { name: 'Model' }), {
    key: 'ArrowDown'
  })
  fireEvent.click(await screen.findByRole('option', { name: 'Next model' }))
  fireEvent.click(within(settings).getByRole('radio', { name: 'Full access' }))
  fireEvent.click(
    within(within(settings).getByRole('radiogroup', { name: 'Placement' })).getByRole('radio', {
      name: 'Status bar'
    })
  )
  expect(useAppStore.getState().settings).toMatchObject({
    agentHubOrbAgent: 'codex',
    agentHubOrbModel: 'next-model',
    agentHubOrbPermission: 'free',
    agentHubOrbPlacement: 'statusBar'
  })
  await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce())
  expect(screen.getByRole('region', { name: 'Orb settings' })).toBe(settings)
  expect(mocks.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Back to conversation' }))
  expect(screen.getByRole('textbox', { name: 'Chat draft' })).toBe(draft)
  expect(draft.value).toBe('unfinished plan')
  expect(screen.getByText('Codex · gpt-model')).toBeTruthy()
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
    await show()
    await screen.findByText('Codex · gpt-model')
    await pickOrbMenuItem('Past conversations')
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
    await pickOrbMenuItem('Past conversations')
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
  await show()
  await screen.findByText('Codex · gpt-model')
  await pickOrbMenuItem('Past conversations')
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
  await show()
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

it.each([
  ['responded', 'Answer received'],
  ['denied_by_user', 'Request denied'],
  ['already_resolved', 'This request was answered elsewhere or is no longer available.']
] as const)(
  'removes a %s request only after host closure without leaving a receipt',
  async (reason, message) => {
    const request = orbAsk('current')
    for (const [host, item] of [
      ['remote', request],
      ['local', orbAsk('previous')]
    ] as const) {
      applyAgentHubDelivery(host, item)
      applyAgentHubDelivery(host, {
        ...item,
        kind: 'closed',
        reason: 'responded',
        result: { answer: 'Other', index: null, by: 'human', desktop: 'device' }
      })
    }
    await show(false)
    expect(screen.queryByText('Answer received')).toBeNull()
    act(() => applyAgentHubDelivery('local', request))
    expect(screen.getByRole('img', { name: 'Waiting for your answer' })).toBeTruthy()
    const respond = vi.fn(async () => {})
    const unregister = registerAgentHubRequestResponder(respond)
    try {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: /Second/ })))
      expect(respond).toHaveBeenCalledOnce()
      expect(screen.getByText('Sending…')).toBeTruthy()
      expect(screen.queryByText('Answer received')).toBeNull()
      act(() =>
        applyAgentHubDelivery('local', {
          ...request,
          kind: 'closed',
          reason,
          ...(reason === 'responded'
            ? { result: { answer: 'Second', index: 2, by: 'human' as const, desktop: 'device' } }
            : {})
        })
      )
      expect(screen.queryByText(message)).toBeNull()
      expect(screen.queryByText('Which approach?')).toBeNull()
      expect(screen.queryByText(message)).toBeNull()
      expect(respond).toHaveBeenCalledOnce()
    } finally {
      unregister()
    }
  }
)
