// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentHubOrbConversation } from './AgentHubOrbConversation'
import {
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { clearAgentHubRequestHost } from './agent-hub-requests-store'

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
  textMode: true,
  startLive: vi.fn(async () => {}),
  stopLive: vi.fn(async () => {}),
  muteInput: vi.fn(),
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

it('keeps the retained chat above a slim Orb row and expands only during live voice', () => {
  const { rerender } = render(conversation())
  const destination = useAgentHubOrbPanel.getState().destination
  if (!destination) {
    throw new Error('Expected chat destination')
  }
  expect(
    destination.compareDocumentPosition(stage()) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
  expect(stage().style.getPropertyValue('--orb-diameter')).toBe('40px')
  expect(screen.queryByRole('slider', { name: 'Orb size' })).toBeNull()
  for (const connection of ['connecting', 'live', 'stopping'] as const) {
    rerender(conversation({ ...voice, connection, textMode: false }))
    expect(stage().style.getPropertyValue('--orb-diameter')).toBe('128px')
    expect(useAgentHubOrbPanel.getState().destination).toBe(destination)
  }
  rerender(conversation())
  expect(stage().style.getPropertyValue('--orb-diameter')).toBe('40px')
  expect(useAgentHubOrbPanel.getState().preferredDiameter).toBe(280)
})

it('keeps the inline request host before the sphere and controls', () => {
  useAgentHubOrbPanel.setState({ nativeRequestPending: true })
  render(conversation())
  const request = useAgentHubOrbPanel.getState().requestDestination
  if (!request) {
    throw new Error('Expected inline request destination')
  }
  const sphere = within(stage()).getByRole('img')
  expect(request.hidden).toBe(false)
  expect(request.compareDocumentPosition(sphere) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('keeps voice availability messages inside the control strip', () => {
  render(conversation({ ...voice, reason: 'Native voice support will be checked when started.' }))
  const status = screen.getByRole('status')
  const controls = stage().querySelector('[data-agent-hub-orb-controls]')
  expect(controls?.contains(status)).toBe(true)
  expect(status.classList.contains('bg-muted')).toBe(true)
  expect(useAgentHubOrbPanel.getState().destination?.contains(status)).toBe(false)
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
