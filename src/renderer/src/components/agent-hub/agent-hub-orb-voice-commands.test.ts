import { afterEach, expect, it, vi } from 'vitest'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import {
  agentHubOrbConversationCommandAvailable,
  runAgentHubOrbVoiceCommand,
  toggleAgentHubOrbConversation
} from './agent-hub-orb-voice-commands'
import { readAgentHubOrbVoice } from './agent-hub-orb-voice-context'
import { EMPTY_ORB_VOICE_SNAPSHOT } from './agent-hub-orb-voice-state'

vi.mock('./agent-hub-orb-voice-context', () => ({ readAgentHubOrbVoice: vi.fn() }))
vi.mock('./agent-hub-mirror-mic-state', () => ({ isDictationRunning: () => false }))

afterEach(() => {
  useAgentHubOrbPanel.setState({
    session: null,
    chatVisible: true,
    presentation: 'orb',
    compact: false
  })
  vi.resetAllMocks()
})

it('reopens the chat before starting Live from history or settings', async () => {
  const startLive = vi.fn(() => {
    expect(useAgentHubOrbPanel.getState().chatVisible).toBe(true)
    return Promise.resolve()
  })
  const controller = {
    getSnapshot: () => ({ ...EMPTY_ORB_VOICE_SNAPSHOT, canStart: true }),
    startLive
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the command reads only getSnapshot and startLive.
  vi.mocked(readAgentHubOrbVoice).mockReturnValue(controller as never)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the command reads only session.tabId.
  useAgentHubOrbPanel.setState({
    session: { sessionId: 's', tabId: 't' } as never,
    chatVisible: false
  })
  runAgentHubOrbVoiceCommand('toggleOrbLive')
  await vi.waitFor(() => expect(startLive).toHaveBeenCalledTimes(1))
})

it('shows the conversation, then minimizes the Orb, and ignores history and settings', () => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the command reads only session ids.
  const session = { sessionId: 's', tabId: 't' } as never
  useAgentHubOrbPanel.setState({ session, presentation: 'orb', compact: false })
  toggleAgentHubOrbConversation()
  expect(useAgentHubOrbPanel.getState()).toMatchObject({ presentation: 'chat', compact: false })
  toggleAgentHubOrbConversation()
  expect(useAgentHubOrbPanel.getState()).toMatchObject({ presentation: 'chat', compact: true })
  toggleAgentHubOrbConversation()
  expect(useAgentHubOrbPanel.getState()).toMatchObject({ presentation: 'chat', compact: false })

  useAgentHubOrbPanel.setState({ chatVisible: false })
  expect(agentHubOrbConversationCommandAvailable()).toBe(false)
  toggleAgentHubOrbConversation()
  expect(useAgentHubOrbPanel.getState().compact).toBe(false)
})
