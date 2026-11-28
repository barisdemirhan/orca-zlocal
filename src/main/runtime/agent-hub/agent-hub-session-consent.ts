import type {
  AgentHubCaller,
  AgentHubPane,
  AgentHubResponse
} from '../../../shared/agent-hub-requests'
import { AgentHubError } from './agent-hub-error'
import { agentHubCallerRateKey } from './agent-hub-rate-limits'
import { agentHubTargetNeedsConsent } from './agent-hub-target-consent'

function grantKey(caller: AgentHubCaller, target: AgentHubPane): string {
  return JSON.stringify([agentHubCallerRateKey(caller), target.paneKey])
}

/** Which callers the user let touch another pane, for this session. */
export class AgentHubSessionConsent {
  private readonly grants = new Set<string>()

  constructor(private readonly parentOf: (paneKey: string) => string | undefined) {}

  needed(caller: AgentHubCaller, target: AgentHubPane): boolean {
    return (
      agentHubTargetNeedsConsent(caller, target, this.parentOf) &&
      !this.grants.has(grantKey(caller, target))
    )
  }

  accept(caller: AgentHubCaller, target: AgentHubPane, response: AgentHubResponse): void {
    if (response.kind !== 'consent') {
      throw new AgentHubError('invalid_argument', 'Invalid consent response')
    }
    if (response.decision === 'deny') {
      throw new AgentHubError('denied_by_user', 'The user denied access to another pane')
    }
    if (response.decision === 'session') {
      this.grants.add(grantKey(caller, target))
    }
  }

  clear(): void {
    this.grants.clear()
  }
}
