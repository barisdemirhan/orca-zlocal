import { describe, expect, it } from 'vitest'
import { agentHubOrbStateKey } from './agent-hub-orb-phase'

describe('agentHubOrbStateKey', () => {
  it('folds the result phase into success or error', () => {
    expect(agentHubOrbStateKey('result', 'success')).toBe('success')
    expect(agentHubOrbStateKey('result', 'error')).toBe('error')
  })

  it('keeps every other phase as its own state', () => {
    expect(agentHubOrbStateKey('attention', 'error')).toBe('attention')
    expect(agentHubOrbStateKey('listening', 'success')).toBe('listening')
  })
})
