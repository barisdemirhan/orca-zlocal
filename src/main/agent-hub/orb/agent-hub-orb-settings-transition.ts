import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import type { normalizeAgentHubOrbSettings } from '../../../shared/agent-hub-orb-settings'
import { projectStructuredAgentSessionStatus } from '../../../shared/structured-agent-session-projection'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'
import type { AgentHubLedger } from '../../runtime/agent-hub/agent-hub-ledger'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'

type OrbSettings = ReturnType<typeof normalizeAgentHubOrbSettings>

export function agentHubOrbSettingsNeedTransition(
  previous: OrbSettings,
  settings: OrbSettings,
  record: AgentSessionRecord | null
): boolean {
  return (
    previous.permission !== settings.permission ||
    ((previous.agent !== settings.agent || previous.model !== settings.model) &&
      (record?.provider !== settings.agent || (record?.options?.model ?? null) !== settings.model))
  )
}

export async function requireIdleAgentHubOrbSession(
  host: StructuredAgentSessionHost,
  hub: Pick<AgentHubLedger, 'snapshot'>,
  sessionId: string
): Promise<void> {
  const snapshot = await host.journalSnapshot(sessionId)
  const fence = host.deps.store.getRecord(sessionId)?.lease.runtimeFence
  const pendingAsk = hub
    .snapshot()
    .requests.some(
      (request) =>
        (request.kind === 'ask' || request.kind === 'consent') &&
        request.caller.kind === 'orb' &&
        request.caller.sessionId === sessionId
    )
  if (
    pendingAsk ||
    projectStructuredAgentSessionStatus(snapshot.items, snapshot.submissions, fence) !== 'idle'
  ) {
    throw new AgentHubError(
      'invalid_argument',
      'Orb is still using its current agent, model, and permissions while work or a question is pending. Finish or stop its work and answer pending questions, then reopen Orb to apply the saved settings.'
    )
  }
}
