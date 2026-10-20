export type AgentHubOrbPhase =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'attention'
  | 'request'
  | 'result'
  | 'error'
  | 'connecting'
  | 'stopping'
  | 'approval'
  | 'dictating'
  | 'transcribing'
  | 'off'

export type AgentHubOrbStateKey = Exclude<AgentHubOrbPhase, 'result'> | 'success'

export function agentHubOrbStateKey(
  phase: AgentHubOrbPhase,
  outcome: 'success' | 'error'
): AgentHubOrbStateKey {
  if (phase !== 'result') {
    return phase
  }
  return outcome === 'error' ? 'error' : 'success'
}
