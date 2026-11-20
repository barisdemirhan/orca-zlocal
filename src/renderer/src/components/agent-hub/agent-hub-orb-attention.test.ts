import { expect, it } from 'vitest'
import type { AgentHubOrbAwareness } from '../../../../shared/agent-hub-orb-awareness'
import { agentHubOrbAttention } from './agent-hub-orb-attention'

const notice = (kind: AgentHubOrbAwareness['notices'][number]['kind']) => ({
  id: kind,
  host: 'local',
  paneKey: 'p',
  title: 't',
  kind,
  text: 'x'
})
const snapshot = (
  kinds: AgentHubOrbAwareness['notices'][number]['kind'][]
): AgentHubOrbAwareness => ({
  observedAt: 1,
  totalAgents: 0,
  truncated: false,
  agents: [],
  notices: kinds.map(notice)
})

it('signals attention only for info notices', () => {
  expect(agentHubOrbAttention(null)).toBe(false)
  expect(agentHubOrbAttention(snapshot(['decision', 'quota', 'result']))).toBe(false)
  expect(agentHubOrbAttention(snapshot(['decision', 'info']))).toBe(true)
})
