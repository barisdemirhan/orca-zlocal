// @vitest-environment happy-dom
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { AgentHubOrbConversation } from './AgentHubOrbConversation'
import {
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { orbAsk } from './agent-hub-orb-test-fixtures'
import { applyAgentHubDelivery, clearAgentHubRequestHost } from './agent-hub-requests-store'
import { AgentHubOrbComposerContext, useAgentHubOrbComposerBinding } from './agent-hub-orb-composer'
import type { NativeChatComposerInput } from '../native-chat/native-chat-composer-input'
import { AGENT_HUB_ORB_DOUBLE_CLICK_MS } from './use-agent-hub-orb-sphere-gestures'
import type { AgentHubOrbState } from './agent-hub-orb-state'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      dictationState: 'idle',
      unifiedTabsByWorktree: {},
      settings: undefined,
      updateSettings: vi.fn()
    }))
  }
})
vi.mock('./agent-hub-orb-conversations', () => ({
  useAgentHubOrbConversations: () => ({
    conversations: [{ sessionId: 'orb', agent: 'codex', title: 'Current chat', lastActiveAt: 1 }],
    error: null,
    refresh: vi.fn()
  })
}))
vi.mock('./AgentHubSettingsOrbSection', () => ({ AgentHubSettingsOrbSection: () => null }))
vi.mock('@/runtime/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => ({
    getSnapshot: () => new Map(),
    activate: () => () => {},
    subscribe: () => () => {},
    subscribeSession: () => () => {},
    getSessionObservation: () => 'unverifiable'
  })
}))

const voice: AgentHubOrbVoiceValue = {
  capability: 'supported',
  canStart: true,
  connection: 'off',
  input: 'listening',
  output: 'silent',
  outputMuted: false,
  textMode: true,
  startLive: vi.fn(async () => {}),
  stopLive: vi.fn(async () => {}),
  muteInput: vi.fn(),
  muteOutput: vi.fn(),
  stopSpeaking: vi.fn(),
  switchToText: vi.fn(async () => {}),
  prepareDictation: vi.fn(async () => true)
}
const props = {
  sessionId: 'orb',
  tabId: 'orb-tab',
  state: { kind: 'idle' } as const,
  visible: true,
  requestPresentationOf: vi.fn(() => ({
    title: 'Orb',
    targetTitle: 'Orb',
    target: null,
    location: { project: 'Orca', group: null, workspace: null }
  }))
}
const conversation = (value = voice) => (
  <TooltipProvider>
    <AgentHubOrbConversation {...props} voice={value} />
  </TooltipProvider>
)
const composer = { insertText: vi.fn(), send: vi.fn() }
function Composer(): null {
  const input = useRef<NativeChatComposerInput | null>(null)
  if (!input.current) {
    input.current = {
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      disabled: false,
      focus: () => {},
      select: () => {},
      setSelectionRange: () => {},
      insertText: composer.insertText
    }
  }
  useAgentHubOrbComposerBinding(input, composer.send)
  return null
}
const writing = (state: AgentHubOrbState = props.state) => (
  <AgentHubOrbComposerContext.Provider value="orb-tab">
    <TooltipProvider>
      <Composer />
      <AgentHubOrbConversation {...props} state={state} voice={voice} />
    </TooltipProvider>
  </AgentHubOrbComposerContext.Provider>
)
function clickSphere(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Message Orb' }))
  act(() => vi.advanceTimersByTime(AGENT_HUB_ORB_DOUBLE_CLICK_MS))
}
function stage(): HTMLElement {
  const element = document.querySelector('[data-agent-hub-orb-stage]')
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected Orb stage')
  }
  return element
}
beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ dictationState: 'idle' })
  clearAgentHubRequestHost('local')
  closeAgentHubOrbPanel()
  showAgentHubOrbPanel({ sessionId: 'orb', tabId: 'orb-tab', resumed: false })
  useAgentHubOrbPanel.setState({
    presentation: 'chat',
    preferredDiameter: 280,
    stagePosition: null
  })
})
afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
  clearAgentHubRequestHost('local')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('keeps the retained chat without a separate Orb strip in every Live phase', () => {
  const { rerender } = render(conversation())
  const destination = useAgentHubOrbPanel.getState().destination
  expect(destination).not.toBeNull()
  expect(document.querySelector('[data-agent-hub-orb-stage]')).toBeNull()
  for (const connection of ['connecting', 'live', 'stopping'] as const) {
    rerender(conversation({ ...voice, connection, textMode: false }))
    expect(document.querySelector('[data-agent-hub-orb-stage]')).toBeNull()
    expect(useAgentHubOrbPanel.getState().destination).toBe(destination)
  }
})

it('does not cancel a newer panel launch from an older conversation control', async () => {
  showAgentHubOrbPanel({ sessionId: 'newer-orb', tabId: 'newer-tab', resumed: false }, 'live')
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  const pending = useAgentHubOrbPanel.getState().launchRequest
  const sequence = useAgentHubOrbPanel.getState().launchSequence
  render(conversation())
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mini window' })))
  expect(useAgentHubOrbPanel.getState().launchRequest).toBe(pending)
  expect(useAgentHubOrbPanel.getState().launchSequence).toBe(sequence)
})

it('places a pending request above the retained chat in a modal', () => {
  useAgentHubOrbPanel.setState({ nativeRequestPending: true, nativeRequestId: 'ask' })
  render(conversation())
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(document.querySelector('[data-agent-hub-orb-stage]')).toBeNull()
})

it('shows no voice notice while support is unknown, and keeps a real failure inside the stage', () => {
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  const pending = 'Native voice support will be checked when started.'
  const { rerender } = render(conversation({ ...voice, capability: 'unknown', reason: pending }))
  expect(screen.queryByRole('status')).toBeNull()
  rerender(conversation({ ...voice, capability: 'error', reason: 'Could not check live voice.' }))
  expect(stage().contains(screen.getByRole('status'))).toBe(true)
  expect(useAgentHubOrbPanel.getState().destination?.contains(screen.getByRole('status'))).toBe(
    false
  )
})

it('removes a resolved Hub question without leaving an answer receipt', async () => {
  const old = orbAsk('orb')
  applyAgentHubDelivery('local', old)
  applyAgentHubDelivery('local', { ...old, kind: 'closed', reason: 'responded' })
  render(conversation())
  expect(document.querySelector('[data-agent-hub-orb-request-receipt]')).toBeNull()
  const current = { ...orbAsk('orb'), requestId: 'current-request' }
  act(() => {
    applyAgentHubDelivery('local', current)
  })
  act(() => {
    applyAgentHubDelivery('local', { ...current, kind: 'closed', reason: 'responded' })
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(document.querySelector('[data-agent-hub-orb-request-receipt]')).toBeNull()
  act(() => {
    closeAgentHubOrbPanel()
    showAgentHubOrbPanel({ sessionId: 'orb', tabId: 'orb-tab', resumed: true })
  })
  expect(document.querySelector('[data-agent-hub-orb-request-receipt]')).toBeNull()
})

it('offers only Expand and Sleep on the compact sphere, with no history, settings or resize', () => {
  useAgentHubOrbPanel.setState({ compact: true })
  render(conversation())
  expect(screen.queryByRole('button', { name: 'Past conversations' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Orb settings' })).toBeNull()
  expect(screen.queryByRole('slider', { name: 'Orb size' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand Orb' }))
  expect(useAgentHubOrbPanel.getState().compact).toBe(false)
  expect(useAgentHubOrbPanel.getState().presentation).toBe('orb')
})

it('opens the writing box on a sphere click, sends Enter and waits with the question in the bubble', () => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  render(writing())
  const box = stage().querySelector('[data-agent-hub-orb-quick-input]')
  expect(box?.getAttribute('data-open')).toBe('false')
  clickSphere()
  expect(box?.getAttribute('data-open')).toBe('true')
  const input = screen.getByRole('textbox', { name: 'Message Orb' })
  fireEvent.change(input, { target: { value: 'Run the tests' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(composer.insertText).toHaveBeenCalledWith('Run the tests')
  expect(composer.send).toHaveBeenCalledOnce()
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Message Orb' }).value).toBe('')
  expect(box?.getAttribute('data-open')).toBe('false')
  expect(screen.getByText('Run the tests')).toBeTruthy()
  expect(screen.getByText('Thinking…')).toBeTruthy()
  clickSphere()
  expect(box?.getAttribute('data-open')).toBe('true')
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(box?.getAttribute('data-open')).toBe('false')
  expect(screen.getByText('Thinking…')).toBeTruthy()
})

it('names the running command under the question and keeps the question above the reply', () => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  const view = render(writing())
  clickSphere()
  const input = screen.getByRole('textbox', { name: 'Message Orb' })
  fireEvent.change(input, { target: { value: 'Did the tests pass?' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  view.rerender(writing({ kind: 'working', command: 'pnpm test' }))
  expect(screen.getByText('pnpm test')).toBeTruthy()
  view.rerender(
    writing({
      kind: 'done',
      summary: 'All green.',
      reply: 'All green.',
      expiresAt: Date.now() + 6000
    })
  )
  expect(screen.getByText('Did the tests pass?')).toBeTruthy()
  expect(screen.getByText('All green.')).toBeTruthy()
  expect(screen.queryByText('pnpm test')).toBeNull()
})

it('steps a question aside with Answer later and brings it back on the next sphere click', () => {
  vi.useFakeTimers()
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  applyAgentHubDelivery('local', orbAsk('orb'))
  render(writing())
  const host = stage().querySelector('[data-agent-hub-orb-request-host]')
  expect(host?.hasAttribute('hidden')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Answer later' }))
  expect(host?.hasAttribute('hidden')).toBe(true)
  expect(useAgentHubOrbPanel.getState().quickInputOpen).toBe(true)
  clickSphere()
  expect(host?.hasAttribute('hidden')).toBe(false)
  expect(useAgentHubOrbPanel.getState().quickInputOpen).toBe(false)
})

function miniWindow(): HTMLElement | null {
  return document.querySelector('[data-agent-hub-orb-mini-window]')
}

it('opens the mini window where the sphere was on a double click and the full chat from its header', () => {
  vi.useFakeTimers()
  useAgentHubOrbPanel.setState({ presentation: 'orb', stagePosition: { x: 100, y: 120 } })
  render(writing())
  const sphere = screen.getByRole('button', { name: 'Message Orb' })
  fireEvent.click(sphere)
  fireEvent.click(sphere)
  expect(useAgentHubOrbPanel.getState().presentation).toBe('mini')
  expect(useAgentHubOrbPanel.getState().quickInputOpen).toBe(false)
  const mini = miniWindow()
  expect(mini?.style.left).toBe('100px')
  expect(mini?.style.top).toBe('120px')
  expect(document.querySelector('[data-agent-hub-orb-stage]')).toBeNull()
  const { destination, requestDestination } = useAgentHubOrbPanel.getState()
  expect(destination).not.toBeNull()
  expect(mini?.contains(destination)).toBe(true)
  expect(requestDestination).toBe(mini?.querySelector('[data-agent-hub-orb-request-host]'))
  fireEvent.click(screen.getByRole('button', { name: 'Open full chat' }))
  expect(useAgentHubOrbPanel.getState().presentation).toBe('chat')
  expect(miniWindow()).toBeNull()
  expect(useAgentHubOrbPanel.getState().destination).not.toBeNull()
})

it('opens the mini window from the reply bubble and steps back to the sphere from its header', () => {
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  render(
    <TooltipProvider>
      <AgentHubOrbConversation
        {...props}
        voice={voice}
        state={{
          kind: 'done',
          summary: 'Done',
          reply: 'All tests passed',
          expiresAt: Date.now() + 60_000
        }}
      />
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
  expect(useAgentHubOrbPanel.getState().presentation).toBe('mini')
  fireEvent.click(screen.getByRole('button', { name: 'Back to Orb' }))
  expect(useAgentHubOrbPanel.getState().presentation).toBe('orb')
  expect(miniWindow()).toBeNull()
  expect(stage()).toBeTruthy()
})

it('closes only this reply from the bubble, across a trip to the mini window, until the next one', () => {
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  const done = (reply: string, expiresAt: number) => (
    <TooltipProvider>
      <AgentHubOrbConversation
        {...props}
        voice={voice}
        state={{ kind: 'done', summary: 'Done', reply, expiresAt }}
      />
    </TooltipProvider>
  )
  const { rerender } = render(done('All tests passed', 1))
  const reply = () => screen.queryByText('All tests passed')
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(reply()).toBeNull()
  act(() => useAgentHubOrbPanel.setState({ presentation: 'mini' }))
  act(() => useAgentHubOrbPanel.setState({ presentation: 'orb' }))
  expect(reply()).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show captions' }))
  expect(reply()).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  rerender(done('All tests passed', 2))
  expect(reply()).not.toBeNull()
})
