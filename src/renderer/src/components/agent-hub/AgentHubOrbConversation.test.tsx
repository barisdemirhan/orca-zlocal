// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'

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

it('stops its own dictation when text is selected and keeps the same chat destination', async () => {
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  const stopTracking = trackAgentHubDictationOrigin()
  const actions: unknown[] = []
  const control = (event: Event) => {
    if (event instanceof CustomEvent) {
      actions.push(event.detail)
    }
  }
  document.addEventListener(DICTATION_CONTROL_EVENT, control)
  try {
    render(conversation())
    const destination = useAgentHubOrbPanel.getState().destination
    if (!destination) {
      throw new Error('Expected retained chat destination')
    }
    const draft = document.createElement('textarea')
    draft.value = 'Already typed'
    destination.append(draft)
    draft.focus()
    act(() => useAppStore.setState({ dictationState: 'listening' }))
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'Switch to text' })))
    expect(actions).toEqual(['stop'])
    expect(voice.switchToText).toHaveBeenCalledOnce()
    act(() => useAppStore.setState({ dictationState: 'idle' }))
    expect(document.querySelector('[data-agent-hub-orb-stage]')).toBeNull()
    expect(useAgentHubOrbPanel.getState().destination).toBe(destination)
    expect(draft.value).toBe('Already typed')
  } finally {
    act(() => useAppStore.setState({ dictationState: 'idle' }))
    stopTracking()
    document.removeEventListener(DICTATION_CONTROL_EVENT, control)
  }
})

it('does not cancel a newer panel launch from an older conversation control', async () => {
  showAgentHubOrbPanel({ sessionId: 'newer-orb', tabId: 'newer-tab', resumed: false }, 'live')
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  const pending = useAgentHubOrbPanel.getState().launchRequest
  const sequence = useAgentHubOrbPanel.getState().launchSequence
  render(conversation())
  await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'Switch to text' })))
  expect(useAgentHubOrbPanel.getState().launchRequest).toBe(pending)
  expect(useAgentHubOrbPanel.getState().launchSequence).toBe(sequence)
})

it('places a pending request above the retained chat in a modal', () => {
  useAgentHubOrbPanel.setState({ nativeRequestPending: true, nativeRequestId: 'ask' })
  render(conversation())
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(document.querySelector('[data-agent-hub-orb-stage]')).toBeNull()
})

it('keeps voice availability messages inside the floating control strip', () => {
  useAgentHubOrbPanel.setState({ presentation: 'orb' })
  render(conversation({ ...voice, reason: 'Native voice support will be checked when started.' }))
  const status = screen.getByRole('status')
  const controls = stage().querySelector('[data-agent-hub-orb-controls]')
  expect(controls?.contains(status)).toBe(true)
  expect(status.classList.contains('bg-muted')).toBe(true)
  expect(useAgentHubOrbPanel.getState().destination?.contains(status)).toBe(false)
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

it('keeps compact actions in one strip with history, new and settings only in its menu', async () => {
  const user = userEvent.setup()
  useAgentHubOrbPanel.setState({ compact: true })
  render(conversation())
  expect(screen.queryByRole('button', { name: 'Past conversations' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'New' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Orb settings' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Minimize Orb' })).toBeNull()
  expect(screen.queryByRole('slider', { name: 'Orb size' })).toBeNull()
  const controls = stage().querySelector('[data-agent-hub-orb-controls]')
  expect(controls?.contains(screen.getByRole('button', { name: 'Expand Orb' }))).toBe(true)
  const close = screen.getByRole('button', { name: 'Close Orb' })
  expect(controls?.contains(close)).toBe(true)
  expect(within(stage()).getAllByRole('button').at(-1)).toBe(close)
  await user.click(screen.getByRole('button', { name: 'Orb options' }))
  expect(screen.getByRole('menuitem', { name: 'Past conversations' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'New' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Orb settings' })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  act(() => close.focus())
  fireEvent.click(close)
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
})
