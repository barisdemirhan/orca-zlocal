import { describe, expect, it } from 'vitest'
import { agentHubOrbPresentation } from './agent-hub-orb-presentation'
import {
  EMPTY_ORB_VOICE_SNAPSHOT,
  type AgentHubOrbVoiceSnapshot
} from './agent-hub-orb-voice-state'

const live: AgentHubOrbVoiceSnapshot = {
  ...EMPTY_ORB_VOICE_SNAPSHOT,
  connection: 'live',
  input: 'listening',
  textMode: false
}

describe('agentHubOrbPresentation', () => {
  it('keeps the listening phase when the microphone is muted', () => {
    const result = agentHubOrbPresentation(
      { kind: 'listening' },
      { ...live, input: 'muted' },
      false
    )
    expect(result.phase).toBe('listening')
    expect(result.label).toMatch(/muted/i)
  })

  it('keeps thinking while the microphone is muted', () => {
    const result = agentHubOrbPresentation({ kind: 'working' }, { ...live, input: 'muted' }, false)
    expect(result.phase).toBe('thinking')
  })

  it('keeps speaking when the speaker is muted', () => {
    const result = agentHubOrbPresentation(
      { kind: 'listening' },
      { ...live, output: 'speaking', outputMuted: true },
      false
    )
    expect(result.phase).toBe('speaking')
  })

  it('shows attention above idle and listening but below working and requests', () => {
    expect(
      agentHubOrbPresentation({ kind: 'idle' }, EMPTY_ORB_VOICE_SNAPSHOT, false, null, false, true)
        .phase
    ).toBe('attention')
    expect(
      agentHubOrbPresentation({ kind: 'listening' }, live, false, null, false, true).phase
    ).toBe('attention')
    expect(agentHubOrbPresentation({ kind: 'working' }, live, false, null, false, true).phase).toBe(
      'thinking'
    )
    expect(
      agentHubOrbPresentation({ kind: 'idle' }, EMPTY_ORB_VOICE_SNAPSHOT, true, null, false, true)
        .phase
    ).toBe('request')
  })
})
