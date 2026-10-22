// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { sleepAgentHubOrb } from './agent-hub-orb-sleep'
import {
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel,
  useAgentHubOrbPanel
} from './agent-hub-orb-panel-store'
import { DICTATION_CONTROL_EVENT } from '../dictation/dictation-control-events'

const mocks = vi.hoisted(() => {
  const dictation: { tabId: string | null } = { tabId: null }
  return { close: vi.fn(), toast: Object.assign(vi.fn(), { error: vi.fn() }), dictation }
})
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ dictationState: 'idle' })) }
})
vi.mock('./agent-hub-dictation-origin', () => ({
  readAgentHubDictationSession: () =>
    mocks.dictation.tabId ? { pane: { tabId: mocks.dictation.tabId } } : null
}))

beforeEach(() => {
  vi.clearAllMocks()
  closeAgentHubOrbPanel()
  mocks.dictation.tabId = null
  useAppStore.setState({ dictationState: 'idle' })
  mocks.close.mockResolvedValue(undefined)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { agentHub: { orb: { close: mocks.close } } }
  })
  showAgentHubOrbPanel({ sessionId: 'orb', tabId: 'orb-tab', resumed: false })
})

it('ends the host session, hides the panel and says where the conversation went', async () => {
  await sleepAgentHubOrb()
  expect(mocks.close).toHaveBeenCalledOnce()
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  expect(mocks.toast).toHaveBeenCalledWith('Orb is asleep. The conversation is in History.')
})

it('throws away the Orb recording first and reports a host failure', async () => {
  useAppStore.setState({ dictationState: 'listening' })
  mocks.dictation.tabId = 'orb-tab'
  const control = vi.fn()
  document.addEventListener(DICTATION_CONTROL_EVENT, control)
  mocks.close.mockRejectedValueOnce(new Error('Host is away'))
  await sleepAgentHubOrb()
  document.removeEventListener(DICTATION_CONTROL_EVENT, control)
  expect(control).toHaveBeenCalledOnce()
  expect(useAgentHubOrbPanel.getState().session).toBeNull()
  expect(mocks.toast.error).toHaveBeenCalledWith('Host is away')
})
