import type { AgentHubInboxRequest } from './agent-hub-requests-store'

export function agentHubCurrentOrbRequest(
  item: AgentHubInboxRequest,
  owner: { host: string; sessionId: string } | null
): boolean {
  return (
    owner !== null &&
    item.host === owner.host &&
    item.request.caller.kind === 'orb' &&
    item.request.caller.sessionId === owner.sessionId
  )
}
