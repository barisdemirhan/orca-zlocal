export type AgentHubOrbSphereAction = 'none' | 'finish-dictation' | 'quick-input'

/** What a click on the floating sphere does: Live owns it, a recording ends, else the box toggles. */
export function agentHubOrbSphereAction(state: {
  liveActive: boolean
  dictating: boolean
}): AgentHubOrbSphereAction {
  if (state.liveActive) {
    return 'none'
  }
  return state.dictating ? 'finish-dictation' : 'quick-input'
}

/** The pill is for a running Live or dictation session; "working" shows on the sphere itself. */
export function agentHubOrbPillShown(kind: string): boolean {
  return kind === 'listening'
}
