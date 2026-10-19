export type AgentHubOrbVoiceSnapshot = {
  capability: 'unknown' | 'checking' | 'supported' | 'unsupported' | 'error'
  connection: 'off' | 'connecting' | 'live' | 'stopping' | 'error'
  input: 'listening' | 'muted'
  output: 'silent' | 'speaking'
  outputMuted: boolean
  inputSpeaking?: boolean
  textMode: boolean
  canStart: boolean
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
