// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { NativeChatOrbPromptSlot } from './NativeChatOrbPromptSlot'
import {
  closeAgentHubOrbPanel,
  setAgentHubOrbRequestDestination,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from '../agent-hub/agent-hub-orb-panel-store'

afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
})

it('moves the same pending answer field without losing the draft and ignores a different session', () => {
  showAgentHubOrbPanel({ sessionId: 'orb', tabId: 'tab', resumed: false })
  const first = document.createElement('div')
  const second = document.createElement('div')
  document.body.append(first, second)
  const view = render(
    <NativeChatOrbPromptSlot tabId="tab" sessionId="orb" pending>
      <input aria-label="Answer" defaultValue="" />
    </NativeChatOrbPromptSlot>
  )
  const input = screen.getByRole('textbox', { name: 'Answer' })
  fireEvent.input(input, { target: { value: 'Keep this answer' } })
  act(() => setAgentHubOrbRequestDestination(first))
  expect(first.contains(input)).toBe(true)
  act(() => setAgentHubOrbRequestDestination(second))
  expect(second.contains(input)).toBe(true)
  expect(screen.getByRole('textbox', { name: 'Answer' })).toHaveProperty(
    'value',
    'Keep this answer'
  )
  expect(useAgentHubOrbPanel.getState().nativeRequestPending).toBe(true)
  act(() => showAgentHubOrbPanel({ sessionId: 'different', tabId: 'tab', resumed: false }))
  expect(second.contains(input)).toBe(false)
  expect(useAgentHubOrbPanel.getState().nativeRequestPending).toBe(false)
  view.unmount()
  first.remove()
  second.remove()
})

it('keeps a normal Chat View answer inline and does not set Orb pending state', () => {
  const view = render(
    <NativeChatOrbPromptSlot tabId="chat-tab" sessionId="chat" pending>
      <input aria-label="Chat answer" defaultValue="Draft" />
    </NativeChatOrbPromptSlot>
  )
  expect(view.container.contains(screen.getByRole('textbox', { name: 'Chat answer' }))).toBe(true)
  expect(useAgentHubOrbPanel.getState().nativeRequestPending).toBe(false)
})
