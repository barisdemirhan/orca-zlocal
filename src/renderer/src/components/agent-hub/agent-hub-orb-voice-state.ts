export type AgentHubOrbVoiceSnapshot = {
  capability: 'unknown' | 'checking' | 'supported' | 'unsupported' | 'error'
  connection: 'off' | 'connecting' | 'live' | 'stopping' | 'error'
  input: 'listening' | 'muted'
  output: 'silent' | 'speaking'
  outputMuted: boolean
  inputSpeaking?: boolean
  textMode: boolean
  canStart: boolean
  caption?: string
  reason?: string
}

export const EMPTY_ORB_VOICE_SNAPSHOT: AgentHubOrbVoiceSnapshot = {
  capability: 'unknown',
  connection: 'off',
  input: 'muted',
  output: 'silent',
  outputMuted: false,
  textMode: true,
  canStart: false
}

export function nextAgentHubOrbVoiceSnapshot(
  current: AgentHubOrbVoiceSnapshot,
  change: Partial<AgentHubOrbVoiceSnapshot>,
  supported: boolean
): AgentHubOrbVoiceSnapshot {
  const next = { ...current, ...change }
  return {
    ...next,
    canStart: supported && next.capability !== 'unsupported' && next.capability !== 'checking'
  }
}

/** Nothing is worth showing while support is still unknown or being checked, or when the Live button's tooltip says it. */
export function agentHubOrbVoiceNotice(snapshot: AgentHubOrbVoiceSnapshot): string | undefined {
  if (snapshot.connection === 'error') {
    return snapshot.reason
  }
  const settled = snapshot.capability === 'supported' || snapshot.capability === 'error'
  return settled ? snapshot.reason : undefined
}
