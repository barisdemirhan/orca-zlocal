// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { AgentHubOrbMiniWindow } from './AgentHubOrbMiniWindow'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ settings: undefined })) }
})
vi.mock('@/runtime/native-chat/status/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => ({
    getSnapshot: () => new Map(),
    activate: () => () => {},
    subscribe: () => () => {},
    subscribeSession: () => () => {},
    getSessionObservation: () => 'unverifiable'
  })
}))

const actions = {
  onShowChat: vi.fn(),
  onMinimize: vi.fn(),
  onSleep: vi.fn(),
  onHide: vi.fn()
}
const miniWindow = () => (
  <TooltipProvider>
    <AgentHubOrbMiniWindow
      sessionId="orb"
      sphere={{ phase: 'idle', label: 'Orb is idle' }}
      agentLabel="Codex · gpt-model"
      busy={false}
      request={null}
      requestVisible={false}
      {...actions}
    >
      <div data-testid="chat" />
    </AgentHubOrbMiniWindow>
  </TooltipProvider>
)
beforeEach(() => {
  closeAgentHubOrbPanel()
  useAgentHubOrbPanel.setState({ stagePosition: { x: 200, y: 100 }, miniPosition: null })
  useAppStore.setState({ settings: createGlobalSettingsFixture({ agentHubOrbPermission: 'ask' }) })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('names the agent and its approval mode and drags by the header, remembering where it lands', () => {
  render(miniWindow())
  const mini = screen.getByRole('region', { name: 'Orb' })
  expect(mini.textContent).toContain('Codex · gpt-model')
  expect(screen.getByLabelText('Ask for approval')).toBeTruthy()
  expect(mini.contains(screen.getByTestId('chat'))).toBe(true)
  expect(mini.style.left).toBe('200px')
  const header = screen.getByText('Codex · gpt-model').parentElement
  if (!header) {
    throw new Error('Expected the mini window header')
  }
  header.setPointerCapture = vi.fn()
  header.hasPointerCapture = () => true
  header.releasePointerCapture = vi.fn()
  fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 300, clientY: 110 })
  fireEvent.pointerMove(header, { pointerId: 1, clientX: 340, clientY: 150 })
  expect(useAgentHubOrbPanel.getState().miniPosition).toEqual({ x: 240, y: 140 })
  fireEvent.pointerUp(header, { pointerId: 1, clientX: 340, clientY: 150 })
  expect(mini.style.left).toBe('240px')
  expect(mini.style.top).toBe('140px')
  fireEvent.click(screen.getByRole('button', { name: 'Open full chat' }))
  fireEvent.click(screen.getByRole('button', { name: 'Put Orb to sleep' }))
  expect(actions.onShowChat).toHaveBeenCalledOnce()
  expect(actions.onSleep).toHaveBeenCalledOnce()
})

it('returns to the sphere from the header sphere', () => {
  render(miniWindow())
  fireEvent.click(screen.getByRole('button', { name: 'Back to Orb' }))
  expect(actions.onMinimize).toHaveBeenCalledOnce()
})

it('does not start a drag from a header button', () => {
  render(miniWindow())
  const hide = screen.getByRole('button', { name: 'Hide Orb' })
  fireEvent.pointerDown(hide, { button: 0, pointerId: 2, clientX: 500, clientY: 110 })
  fireEvent.pointerMove(hide, { pointerId: 2, clientX: 540, clientY: 150 })
  expect(useAgentHubOrbPanel.getState().miniPosition).toBeNull()
  fireEvent.click(hide)
  expect(actions.onHide).toHaveBeenCalledOnce()
})
