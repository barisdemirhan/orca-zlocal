import { describe, expect, it } from 'vitest'
import { agentHubOrbPillShown, agentHubOrbSphereAction } from './agent-hub-orb-sphere-action'

const idle = { liveActive: false, dictating: false, canStartLive: false, canDictate: false }

describe('agentHubOrbSphereAction', () => {
  it('prefers ending Live, then finishing dictation', () => {
    expect(agentHubOrbSphereAction({ ...idle, liveActive: true, canStartLive: true })).toBe(
      'end-live'
    )
    expect(agentHubOrbSphereAction({ ...idle, dictating: true, canDictate: true })).toBe(
      'finish-dictation'
    )
  })
  it('starts Live, else dictates, else opens the chat', () => {
    expect(agentHubOrbSphereAction({ ...idle, canStartLive: true, canDictate: true })).toBe(
      'start-live'
    )
    expect(agentHubOrbSphereAction({ ...idle, canDictate: true })).toBe('dictate')
    expect(agentHubOrbSphereAction(idle)).toBe('show-chat')
  })
})

describe('agentHubOrbPillShown', () => {
  it('shows only while listening', () => {
    expect(agentHubOrbPillShown('listening')).toBe(true)
    expect(agentHubOrbPillShown('working')).toBe(false)
    expect(agentHubOrbPillShown('idle')).toBe(false)
  })
})
