import { describe, expect, it } from 'vitest'
import { agentHubOrbSphereAction } from './agent-hub-orb-sphere-action'

describe('agentHubOrbSphereAction', () => {
  it('leaves Live alone, finishes a recording, otherwise opens the writing box', () => {
    expect(agentHubOrbSphereAction({ liveActive: true, dictating: false })).toBe('none')
    expect(agentHubOrbSphereAction({ liveActive: false, dictating: true })).toBe('finish-dictation')
    expect(agentHubOrbSphereAction({ liveActive: false, dictating: false })).toBe('quick-input')
  })
})
