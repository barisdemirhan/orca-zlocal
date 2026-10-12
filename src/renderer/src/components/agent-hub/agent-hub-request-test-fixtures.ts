import type { AgentHubRequestBase, AgentHubRequest } from '../../../../shared/agent-hub-requests'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'

export function agentHubRequestBase(
  requestId = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
): AgentHubRequestBase {
  const pane = { paneKey: PANE_KEY, terminalHandle: 'term-1' }
  return { requestId, caller: pane, target: pane, createdAt: 0, expiresAt: 10_000 }
}

export function agentHubAskRequest(
  overrides: Partial<Extract<AgentHubRequest, { kind: 'ask' }>> = {}
): Extract<AgentHubRequest, { kind: 'ask' }> {
  return {
    ...agentHubRequestBase(),
    caller: { ...agentHubRequestBase().caller, agentType: 'claude', title: 'Worker terminal' },
    kind: 'ask',
    question: 'Which approach?',
    options: ['First', 'Second', 'Third'],
    multi: false,
    recommended: 2,
    ...overrides
  }
}

export function agentHubNotifyRequest(
  overrides: Partial<Extract<AgentHubRequest, { kind: 'notify' }>> = {}
): Extract<AgentHubRequest, { kind: 'notify' }> {
  return {
    ...agentHubRequestBase(),
    caller: { ...agentHubRequestBase().caller, agentType: 'codex', title: 'Worker terminal' },
    kind: 'notify',
    text: 'Deployment ready',
    level: 'info',
    sound: false,
    links: [],
    ...overrides
  }
}
