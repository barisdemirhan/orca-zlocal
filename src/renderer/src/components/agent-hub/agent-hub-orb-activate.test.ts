import { beforeEach, expect, it, vi } from 'vitest'
import { activateAgentHubOrb } from './agent-hub-orb-composer'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  available: vi.fn(() => false),
  run: vi.fn(),
  connection: 'off'
}))
vi.mock('./agent-hub-orb-open', () => ({ openAgentHubOrb: mocks.open }))
vi.mock('./agent-hub-orb-voice-commands', () => ({
  agentHubOrbVoiceCommandAvailable: mocks.available,
  runAgentHubOrbVoiceCommand: mocks.run
}))
vi.mock('./agent-hub-orb-voice-context', () => ({
  readAgentHubOrbVoice: () => ({ getSnapshot: () => ({ connection: mocks.connection }) })
}))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ dictationState: 'idle', settings: {} })) }
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.available.mockReturnValue(false)
  mocks.connection = 'off'
  closeAgentHubOrbPanel()
})

function openPanel(): void {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: activation reads only session.tabId.
  useAgentHubOrbPanel.setState({ session: { sessionId: 's', tabId: 't' } as never })
}

it('opens a closed Orb and toggles Live once it is open', () => {
  activateAgentHubOrb()
  expect(mocks.open).toHaveBeenCalledOnce()
  expect(mocks.run).not.toHaveBeenCalled()

  openPanel()
  mocks.available.mockReturnValue(true)
  activateAgentHubOrb()
  expect(mocks.run).toHaveBeenCalledWith('toggleOrbLive')
  expect(mocks.open).toHaveBeenCalledOnce()
})

it('leaves a connecting call alone and reopens an Orb without Live', () => {
  openPanel()
  mocks.connection = 'connecting'
  activateAgentHubOrb()
  expect(mocks.open).not.toHaveBeenCalled()

  mocks.connection = 'off'
  activateAgentHubOrb()
  expect(mocks.open).toHaveBeenCalledOnce()
  expect(mocks.run).not.toHaveBeenCalled()
})
