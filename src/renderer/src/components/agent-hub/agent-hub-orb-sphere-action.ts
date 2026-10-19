export type AgentHubOrbSphereAction =
  | 'none'
  | 'finish-dictation'
  | 'start-live'
  | 'dictate'
  | 'show-chat'

/** What a click on the floating sphere does, in priority order. */
export function agentHubOrbSphereAction(state: {
  liveActive: boolean
  dictating: boolean
  canStartLive: boolean
  canDictate: boolean
}): AgentHubOrbSphereAction {
  if (state.liveActive) {
    return 'none'
  }
  if (state.dictating) {
    return 'finish-dictation'
  }
  if (state.canStartLive) {
    return 'start-live'
  }
  return state.canDictate ? 'dictate' : 'show-chat'
}

/** The pill is for a running Live or dictation session; "working" shows on the sphere itself. */
export function agentHubOrbPillShown(kind: string): boolean {
  return kind === 'listening'
}
