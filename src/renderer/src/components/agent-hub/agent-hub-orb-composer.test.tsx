// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
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
function Composer() {
  const input = useRef<HTMLTextAreaElement>(null)
  useAgentHubOrbComposerBinding(input, mocks.send)
  return (
    <div data-agent-hub-orb-chat-tab-id="orb-tab">
      <textarea ref={input} aria-label="Orb draft" />
    </div>
  )
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
      <Composer />
    </AgentHubOrbComposerContext>
  )
  act(toggleAgentHubOrb)
  act(() => useAppStore.setState({ dictationState: 'listening' }))
  act(() => finishAgentHubOrbDictationForText('orb-tab'))
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
