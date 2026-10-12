import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import { PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'

export function agentHubRequestBase(
  requestId = '93b0c108-34c6-4e45-9d13-d8f4170d7456'
): AgentHubRequestBase {
  const pane = { paneKey: PANE_KEY, terminalHandle: 'term-1' }
  return { requestId, caller: pane, target: pane, createdAt: 0, expiresAt: 10_000 }
}
