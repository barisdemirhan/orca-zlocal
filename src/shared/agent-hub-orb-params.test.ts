import { expect, it } from 'vitest'
import { AgentHubOrbListParamsSchema, AgentHubOrbOpenParamsSchema } from './agent-hub-orb-params'

it('admits parameterless Orb reads and bounds history requests', () => {
  expect(AgentHubOrbOpenParamsSchema.parse(undefined)).toEqual({})
  expect(AgentHubOrbListParamsSchema.parse(undefined)).toEqual({})
  for (const limit of [0, -1, 101, 1.5, Infinity]) {
    expect(AgentHubOrbListParamsSchema.safeParse({ limit }).success).toBe(false)
  }
  expect(AgentHubOrbListParamsSchema.parse({ limit: 100 })).toEqual({ limit: 100 })
})

it('validates resume identity, agent names and model input before launch', () => {
  expect(
    AgentHubOrbOpenParamsSchema.parse({
      resume: { sessionId: 'codex_old' },
      agent: 'codex',
      model: null
    })
  ).toEqual({ resume: { sessionId: 'codex_old' }, agent: 'codex', model: null })
  for (const params of [
    { resume: { sessionId: '' } },
    { agent: '' },
    { agent: 'UNKNOWN AGENT' },
    { model: ' ' }
  ]) {
    expect(AgentHubOrbOpenParamsSchema.safeParse(params).success).toBe(false)
  }
})
