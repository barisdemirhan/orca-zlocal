import type { AgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import type { AgentHubOrbVoiceSnapshot } from './agent-hub-orb-voice-state'

export async function checkAgentHubOrbVoiceCapability(
  client: AgentSessionVoiceClient,
  publish: (change: Partial<AgentHubOrbVoiceSnapshot>) => void
): Promise<void> {
  try {
    const result = await client.capability()
    publish({
      capability:
        result.supported === null ? 'unknown' : result.supported ? 'supported' : 'unsupported',
      reason: result.supported ? undefined : result.reason
    })
  } catch {
    publish({ capability: 'error', reason: 'Could not check live voice. Try again.' })
  }
}
