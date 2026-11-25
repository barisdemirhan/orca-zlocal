import type {
  AgentHubCaller,
  AgentHubCardOperation,
  AgentHubCardResult,
  AgentHubResponse
} from '../../../shared/agent-hub-requests'
import { AgentHubError } from './agent-hub-error'
import { agentHubCallerRateKey } from './agent-hub-rate-limits'

export type AgentHubCardCommand =
  | Exclude<AgentHubCardOperation, { action: 'events' }>
  | { action: 'events'; since: 'last' | number }

export class AgentHubCardQuery {
  /** Where `events --since last` resumes, per caller; lost on restart, which only replays. */
  private readonly cursors = new Map<string, number>()

  async run(
    caller: AgentHubCaller,
    command: AgentHubCardCommand,
    query: (card: AgentHubCardOperation) => Promise<AgentHubResponse>
  ): Promise<AgentHubCardResult> {
    const key = agentHubCallerRateKey(caller)
    const response = await query(
      command.action === 'events'
        ? {
            action: 'events',
            since: command.since === 'last' ? (this.cursors.get(key) ?? 0) : command.since
          }
        : command
    )
    if (response.kind !== 'card') {
      throw new AgentHubError(
        'invalid_argument',
        'This desktop does not support card commands; update Orca on it'
      )
    }
    if (response.result.action === 'events') {
      this.cursors.set(key, response.result.cursor)
    }
    return response.result
  }
}
