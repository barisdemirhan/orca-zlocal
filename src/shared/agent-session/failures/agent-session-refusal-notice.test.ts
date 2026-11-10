import { describe, expect, it } from 'vitest'
import {
  agentSessionRefusalCauseParts,
  agentSessionRefusalNotice
} from './agent-session-refusal-notice'
import './agent-session-failure-words'
import './agent-session-refusal-details'
import {
  agentSessionWriteKindForMethod,
  parseAgentSessionWriteFailure
} from './agent-session-write-failure'

describe('saved Arguments refusals', () => {
  it.each([
    { agent: 'Codex', option: '--remote', problem: 'futureProblem' },
    { agent: 'Codex', option: '--remote=private', problem: 'unsupportedOption' }
  ])('ignores an unrecognized or unsafe argument detail', (argumentProblem) => {
    const refused = parseAgentSessionWriteFailure({
      kind: 'refused',
      code: 'agent_session_operation_invalid',
      details: { reason: 'attachFailed', argumentProblem }
    })
    expect(refused).toEqual({
      kind: 'refused',
      code: 'agent_session_operation_invalid',
      details: { reason: 'attachFailed' }
    })
    if (!refused) {
      throw new Error('refusal was not read')
    }
    expect(agentSessionRefusalCauseParts(refused)).toEqual([])
  })
})

describe('Live voice start', () => {
  it('says only that Live could not start when Codex turns the start down', () => {
    expect(
      agentSessionRefusalNotice(
        {
          code: 'agent_session_operation_invalid',
          message: 'host refusal text',
          details: { reason: 'providerRejected' }
        },
        agentSessionWriteKindForMethod('agentSession.startVoice', {})
      )
    ).toBe('Live voice could not start.')
    expect(agentSessionWriteKindForMethod('agentSession.send', {})).toBe('send')
  })
})
