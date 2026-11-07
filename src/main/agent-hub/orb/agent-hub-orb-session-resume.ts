import type { AgentChatPermissionMode } from '../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import type { AgentHubOrbSession } from '../../../shared/agent-hub-orb'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { replaceAgentHubOrbSession } from './agent-hub-orb-settings-transition'

/** Reveals a past Orb chat as the current one. Why the mode rewrite: the saved approvals bound
 *  every Orb chat, so a resumed one restarts under them instead of the ones it was created with. */
export async function resumeAgentHubOrbSession(input: {
  runtime: Parameters<typeof replaceAgentHubOrbSession>[0] &
    Pick<OrcaRuntimeService, 'publishStructuredAgentSessionTab'>
  host: StructuredAgentSessionHost
  current: AgentHubOrbSession | null
  previous: AgentSessionRecord
  mode: AgentChatPermissionMode | null
}): Promise<{ session: AgentHubOrbSession; mode: AgentChatPermissionMode | null }> {
  const { runtime, host, previous, mode } = input
  const session = await replaceAgentHubOrbSession(
    runtime,
    host,
    input.current,
    previous.sessionId,
    async () => {
      if (mode && previous.permissionMode !== mode) {
        await host.deps.store.replaceSessionOptions({
          sessionId: previous.sessionId,
          fence: previous.lease.runtimeFence,
          permissionMode: mode,
          now: Date.now()
        })
      }
      const revealed = await host.revealSession(previous.sessionId)
      await runtime.publishStructuredAgentSessionTab({
        workspaceId: revealed.workspaceId,
        sessionId: revealed.sessionId,
        agent: revealed.agent,
        activate: false
      })
      const tabId = host.getSessionTabId(previous.sessionId)
      return { sessionId: previous.sessionId, ...(tabId ? { tabId } : {}), resumed: true }
    }
  )
  return { session, mode }
}
