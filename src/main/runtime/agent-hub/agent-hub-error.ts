import type { AgentHubErrorCode } from '../../../shared/agent-hub-requests'

export class AgentHubError extends Error {
  constructor(
    readonly code: AgentHubErrorCode,
    message: string,
    readonly data?: { retryAfterMs?: number; requestId?: string }
  ) {
    super(message)
    this.name = 'AgentHubError'
  }
}
