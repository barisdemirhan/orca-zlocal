// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useRef, useSyncExternalStore } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  AgentHubOrbComposerContext,
  finishAgentHubOrbDictationForText,
  toggleAgentHubOrb,
  useAgentHubOrbComposerBinding
} from './agent-hub-orb-composer'
import { closeAgentHubOrbPanel, showAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'
import { cancelDictation } from './agent-hub-dictation-cancel'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'
import { AgentHubOrbVoiceController } from './agent-hub-orb-voice-controller'
import { useAgentHubOrbLaunch } from './use-agent-hub-orb-launch'

const mocks = vi.hoisted(() => ({ open: vi.fn(), send: vi.fn() }))
vi.mock('./agent-hub-orb-open', () => ({ openAgentHubOrb: mocks.open }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      dictationState: 'idle',
      settings: { voice: { enabled: true, sttModel: 'test-model' } }
    }))
  }
})
function Composer({ disabled = false }: { disabled?: boolean }) {
  const input = useRef<HTMLTextAreaElement>(null)
  useAgentHubOrbComposerBinding(input, mocks.send, !disabled)
  return (
    <div data-agent-hub-orb-chat-tab-id="orb-tab">
      <textarea ref={input} aria-label="Orb draft" disabled={disabled} />
    </div>
  )
}
let controller: AgentHubOrbVoiceController
function LaunchControl() {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useAgentHubOrbLaunch(controller, snapshot, true)
  return null
}
let stopTracking: () => void
let actions: string[]
const control = (event: Event) => {
  if (!(event instanceof CustomEvent)) {
    return
  }
  actions.push(event.detail)
  if (event.detail === 'start') {
    useAppStore.setState({ dictationState: 'starting' })
  }
  if (event.detail === 'stop' || event.detail === 'cancel') {
    useAppStore.setState({ dictationState: 'stopping' })
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  closeAgentHubOrbPanel()
  useAppStore.setState({ dictationState: 'idle' })
  actions = []
  stopTracking = trackAgentHubDictationOrigin()
  document.addEventListener(DICTATION_CONTROL_EVENT, control)
  controller = new AgentHubOrbVoiceController(
    { sessionId: 'session', tabId: 'orb-tab', agent: 'codex', hostKey: 'local' },
    {
      appendText: vi.fn(async () => true),
      capability: vi.fn(async () => ({
        supported: true as const,
        accountAccess: 'unchecked' as const
      })),
      subscribe: vi.fn(async () => ({ unsubscribe: () => {} })),
      start: vi.fn(async (owner) => ({ ...owner, state: 'connecting' as const })),
      stop: vi.fn(async (owner) => ({ ...owner, state: 'off' as const }))
    },
    () => ({})
  )
})
afterEach(() => {
  document.removeEventListener(DICTATION_CONTROL_EVENT, control)
  stopTracking()
  cleanup()
  closeAgentHubOrbPanel()
})

it('opens when closed, then targets Orb dictation and sends only after the final text has arrived', async () => {
  toggleAgentHubOrb()
  expect(mocks.open).toHaveBeenCalledOnce()
  showAgentHubOrbPanel({ sessionId: 'session', tabId: 'orb-tab', resumed: false })
  render(
    <AgentHubOrbComposerContext value="orb-tab">
      <Composer />
    </AgentHubOrbComposerContext>
  )
  act(toggleAgentHubOrb)
  expect(document.activeElement).toBe(screen.getByRole('textbox'))
  expect(actions).toEqual(['start'])
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  act(toggleAgentHubOrb)
  expect(actions).toEqual(['start', 'stop'])
  expect(mocks.send).not.toHaveBeenCalled()
  const input = screen.getByRole('textbox')
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error('Expected native composer input')
  }
  input.value = 'Final transcript'
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  expect(mocks.send).toHaveBeenCalledOnce()
})

it('finishes dictation into the text draft without sending and keeps later dictation submission enabled', async () => {
  showAgentHubOrbPanel({ sessionId: 'session', tabId: 'orb-tab', resumed: false })
  render(
    <AgentHubOrbComposerContext value="orb-tab">
      <LaunchControl />
      <Composer />
    </AgentHubOrbComposerContext>
  )
  act(toggleAgentHubOrb)
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  await act(async () =>
    showAgentHubOrbPanel({ sessionId: 'session', tabId: 'orb-tab', resumed: false }, 'text')
  )
  expect(actions).toEqual(['start', 'stop'])
  const input = screen.getByRole('textbox')
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error('Expected native composer input')
  }
  input.value = 'Final transcript kept for editing'
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  expect(input.value).toBe('Final transcript kept for editing')
  expect(mocks.send).not.toHaveBeenCalled()
  act(toggleAgentHubOrb)
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  act(toggleAgentHubOrb)
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  expect(mocks.send).toHaveBeenCalledOnce()
})

it('starts a requested Dictate launch once its retained composer is ready and leaves another recording alone', async () => {
  showAgentHubOrbPanel({ sessionId: 'session', tabId: 'orb-tab', resumed: false }, 'dictate')
  const view = (phase: 'absent' | 'disabled' | 'enabled') => (
    <AgentHubOrbComposerContext value="orb-tab">
      <LaunchControl />
      {phase !== 'absent' ? <Composer disabled={phase === 'disabled'} /> : null}
    </AgentHubOrbComposerContext>
  )
  const { rerender } = render(view('absent'))
  expect(actions).toEqual([])
  await act(async () => rerender(view('disabled')))
  expect(actions).toEqual([])
  rerender(view('enabled'))
  await waitFor(() => expect(actions).toEqual(['start']))
  rerender(view('enabled'))
  expect(actions).toEqual(['start'])
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  const other = document.createElement('input')
  document.body.append(other)
  other.focus()
  act(() => {
    useAppStore.setState({ dictationState: 'listening' })
    showAgentHubOrbPanel({ sessionId: 'session', tabId: 'orb-tab', resumed: false }, 'dictate')
  })
  expect(actions).toEqual(['start'])
  expect(document.activeElement).toBe(other)
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  other.remove()
})

it('does not stop another field, submit a cancelled recording, or send after the panel closes', async () => {
  showAgentHubOrbPanel({ sessionId: 'session', tabId: 'orb-tab', resumed: false })
  render(
    <AgentHubOrbComposerContext value="orb-tab">
      <Composer />
    </AgentHubOrbComposerContext>
  )
  const other = document.createElement('input')
  document.body.append(other)
  other.focus()
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  act(() => finishAgentHubOrbDictationForText('orb-tab'))
  act(toggleAgentHubOrb)
  expect(actions).toEqual([])
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  act(toggleAgentHubOrb)
  act(cancelDictation)
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  act(toggleAgentHubOrb)
  act(toggleAgentHubOrb)
  closeAgentHubOrbPanel()
  act(() => useAppStore.setState({ dictationState: 'idle' }))
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  expect(mocks.send).not.toHaveBeenCalled()
  other.remove()
})
