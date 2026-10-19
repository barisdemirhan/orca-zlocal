import type { AgentSessionVoiceClient } from '@/runtime/agent-session-voice-client'
import type { AgentHubOrbVoiceAttempt } from './agent-hub-orb-voice-attempt'

export function createOrbVoiceContext(
  client: AgentSessionVoiceClient,
  read: () => { sessionId: string; attempt: AgentHubOrbVoiceAttempt | null; live: boolean }
) {
  return {
    key: (): string | null => {
      const state = read()
      return agentHubOrbVoiceContextKey(state.sessionId, state.attempt, state.live)
    },
    append: (text: string): Promise<boolean> =>
      appendAgentHubOrbContext(client, () => read().attempt, read().live, text)
  }
}

export function agentHubOrbVoiceContextKey(
  sessionId: string,
  attempt: AgentHubOrbVoiceAttempt | null,
  live: boolean
): string | null {
  return attempt && !attempt.dead && live
    ? `${sessionId}:${attempt.voiceSessionId}:${attempt.generation}`
    : null
}

export async function appendAgentHubOrbContext(
  client: AgentSessionVoiceClient,
  readAttempt: () => AgentHubOrbVoiceAttempt | null,
  live: boolean,
  text: string
): Promise<boolean> {
  const attempt = readAttempt()
  if (!attempt || attempt.dead || !live) {
    return false
  }
  const applied = await client.appendText(attempt, text)
  return readAttempt() === attempt && !attempt.dead && applied
}
