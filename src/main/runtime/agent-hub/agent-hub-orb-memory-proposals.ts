import type {
  AgentHubRequest,
  AgentHubRequestBase,
  AgentHubResponse
} from '../../../shared/agent-hub-requests'
import { AgentHubError } from './agent-hub-error'
import type { AgentHubPendingRequests } from './agent-hub-pending-requests'

export const AGENT_HUB_ORB_MEMORY_PROPOSAL_TTL_MS = 30 * 60_000
const MAX_PENDING_MEMORIES = 3

export function normalizeAgentHubOrbMemory(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

type MemoryRequest = Extract<AgentHubRequest, { kind: 'memory' }>

/** Declined texts live for this app run only, so a changed mind needs no cleanup. */
export class AgentHubOrbMemoryProposals {
  private readonly declined = new Set<string>()

  constructor(private readonly requests: AgentHubPendingRequests) {}

  propose(base: AgentHubRequestBase, text: string): MemoryRequest {
    this.assertProposable(text, this.requests.snapshot())
    return { ...base, kind: 'memory', text }
  }

  pendingText(requestId: string): string | undefined {
    const request = this.requests.get(requestId)
    return request?.kind === 'memory' ? request.text : undefined
  }

  settle(requestId: string, response: AgentHubResponse, respond: () => void): void {
    const proposed = this.pendingText(requestId)
    respond()
    if (proposed !== undefined && response.kind === 'memory' && response.decision === 'decline') {
      this.declined.add(normalizeAgentHubOrbMemory(proposed))
    }
  }

  private assertProposable(text: string, pending: readonly AgentHubRequest[]): void {
    const key = normalizeAgentHubOrbMemory(text)
    const memories = pending.filter(
      (request): request is MemoryRequest => request.kind === 'memory'
    )
    if (memories.some((request) => normalizeAgentHubOrbMemory(request.text) === key)) {
      throw new AgentHubError('invalid_argument', 'This memory is already proposed.')
    }
    if (this.declined.has(key)) {
      throw new AgentHubError('invalid_argument', 'The user declined this memory earlier.')
    }
    if (memories.length >= MAX_PENDING_MEMORIES) {
      throw new AgentHubError('rate_limited', 'Wait for the user to decide on earlier proposals.')
    }
  }
}
