/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { AgentHubMicModeSetting } from './AgentHubMicModeControl'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const useAppStore = create(() => ({
    settings: { agentHubMicMode: 'dictate' },
    updateSettings: vi.fn(async (updates: { agentHubMicMode?: string }) => {
      useAppStore.setState((s) => ({ settings: { ...s.settings, ...updates } }))
    })
  }))
  return { useAppStore }
})
let canImprove = false
const capabilities = (event: Event): void => {
  if (event instanceof CustomEvent) {
    event.detail.improve = canImprove
  }
}
beforeEach(() => {
  canImprove = false
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Missing test settings')
  }
  useAppStore.setState({ settings: { ...settings, agentHubMicMode: 'dictate' } })
  vi.clearAllMocks()
  document.addEventListener('dictation:capabilities', capabilities)
})
afterEach(() => {
  cleanup()
  document.removeEventListener('dictation:capabilities', capabilities)
})

it('uses the same settings switch grammar and persists both default modes', () => {
  canImprove = true
  render(<AgentHubMicModeSetting />)
  const control = screen.getByRole('switch', { name: 'Improve with an agent' })
  expect(control.getAttribute('aria-checked')).toBe('false')
  fireEvent.click(control)
  expect(useAppStore.getState().settings?.agentHubMicMode).toBe('improve')
  expect(control.getAttribute('aria-checked')).toBe('true')
  fireEvent.click(control)
  expect(useAppStore.getState().settings?.agentHubMicMode).toBe('dictate')
  expect(screen.queryByRole('group', { name: 'Microphone action' })).toBeNull()
  expect(
    screen.getByText(
      'When on, the mirror microphone dictates and improves; Shift-click does the opposite.'
    )
  ).toBeTruthy()
})

it('disables unavailable improvement without rewriting the stored default', () => {
  const settings = useAppStore.getState().settings
  if (!settings) {
    throw new Error('Missing test settings')
  }
  useAppStore.setState({ settings: { ...settings, agentHubMicMode: 'improve' } })
  render(<AgentHubMicModeSetting />)
  const control = screen.getByRole('switch', { name: 'Improve with an agent' })
  expect(control.hasAttribute('disabled')).toBe(true)
  expect(control.getAttribute('aria-checked')).toBe('false')
  expect(screen.getByText('Requires the Improve transcriptions feature.')).toBeTruthy()
  fireEvent.click(control)
  expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
  expect(useAppStore.getState().settings?.agentHubMicMode).toBe('improve')
})

it('rechecks the capability before changing the mode', () => {
  canImprove = true
  render(<AgentHubMicModeSetting />)
  canImprove = false
  fireEvent.click(screen.getByRole('switch', { name: 'Improve with an agent' }))
  expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled()
})
