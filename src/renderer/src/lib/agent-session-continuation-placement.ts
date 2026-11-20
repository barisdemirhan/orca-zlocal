/** Where "Continue in New Session" puts the new session. */
export type AgentSessionContinuationPlacement = 'tab' | 'pane' | 'jump'

export const DEFAULT_AGENT_SESSION_CONTINUATION_PLACEMENT: AgentSessionContinuationPlacement = 'tab'

export const AGENT_SESSION_CONTINUATION_PLACEMENTS: readonly AgentSessionContinuationPlacement[] = [
  'tab',
  'pane',
  'jump'
]
