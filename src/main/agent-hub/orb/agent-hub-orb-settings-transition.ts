import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import type { AgentHubOrbSession } from '../../../shared/agent-hub-orb'
import type { normalizeAgentHubOrbSettings } from '../../../shared/agent-hub-orb-settings'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { AgentHubLedger } from '../../runtime/agent-hub/agent-hub-ledger'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { closeAgentHubOrbSession } from './agent-hub-orb-session-close'

type OrbSettings = ReturnType<typeof normalizeAgentHubOrbSettings>

export function agentHubOrbSettingsNeedTransition(
  previous: OrbSettings | null,
  settings: OrbSettings,
  record: AgentSessionRecord | null
): boolean {
  const differentSelection =
    record !== null &&
    (record.provider !== settings.agent || (record.options?.model ?? null) !== settings.model)
  if (!previous) {
    return differentSelection
  }
  return (
    previous.permission !== settings.permission ||
    ((previous.agent !== settings.agent || previous.model !== settings.model) && differentSelection)
  )
}

export async function replaceAgentHubOrbSession<T>(
  runtime: Pick<
    OrcaRuntimeService,
    'closeMobileSessionTab' | 'publishStructuredAgentSessionTab' | 'isAgentHubEnabled'
  >,
  host: StructuredAgentSessionHost,
  current: AgentHubOrbSession | null,
  replacementId: string,
  replace: () => Promise<T>
): Promise<T> {
  if (current) {
    await closeAgentHubOrbSession(runtime, host, current)
  }
  try {
    return await replace()
  } catch (error) {
    try {
      if (host.deps.store.getRecord(replacementId)) {
        await host.close(replacementId, 'user-close')
        await host.setSessionTabVisibility(replacementId, false)
      }
    } finally {
      if (current && runtime.isAgentHubEnabled()) {
        const revealed = await host.revealSession(current.sessionId)
        await host.setSessionTabVisibility(current.sessionId, true, current.tabId)
        await runtime.publishStructuredAgentSessionTab({
          workspaceId: revealed.workspaceId,
          sessionId: revealed.sessionId,
          agent: revealed.agent,
          activate: false,
          ...(current.tabId ? { tabId: current.tabId } : {})
        })
      }
    }
    throw error
  }
}

export async function requireIdleAgentHubOrbSession(
  host: StructuredAgentSessionHost,
  hub: Pick<AgentHubLedger, 'snapshot'>,
  sessionId: string
): Promise<void> {
  const fence = host.deps.store.getRecord(sessionId)?.lease.runtimeFence
  const { summary } = await (await host.attentionReads.journal(sessionId)).statusState(fence)
  const pendingAsk = hub
    .snapshot()
    .requests.some(
      (request) =>
        (request.kind === 'ask' || request.kind === 'consent') &&
        request.caller.kind === 'orb' &&
        request.caller.sessionId === sessionId
    )
  if (pendingAsk || (summary.status ?? 'idle') !== 'idle') {
    throw new AgentHubError(
      'invalid_argument',
      'Orb is still using its current agent, model, and permissions while work or a question is pending. Finish or stop its work and answer pending questions, then reopen Orb to apply the saved settings.'
    )
  }
}
