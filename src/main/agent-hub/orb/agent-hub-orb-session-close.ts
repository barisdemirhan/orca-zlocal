import type { AgentHubOrbSession } from '../../../shared/agent-hub-orb'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { isStructuredAgentId } from '../../../shared/agent-session/lifecycle/agent-session-provider-handle-encoding'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { AgentHubError } from '../../runtime/agent-hub/agent-hub-error'
import { structuredSessionCloseSettled } from '../../runtime/orchestration/terminal-authority/structured-sessions/structured-worker-authority'
import { readOrbOperations } from '../../runtime/agent-hub/agent-hub-orb-operations'

export async function closeAgentHubOrbSession(
  runtime: Pick<OrcaRuntimeService, 'closeMobileSessionTab' | 'publishStructuredAgentSessionTab'>,
  host: StructuredAgentSessionHost,
  current: AgentHubOrbSession
): Promise<void> {
  const tabId = host.getSessionTabId(current.sessionId)
  if (tabId) {
    try {
      // The runtime snapshot addresses the session; the durable tab id belongs to its window.
      const outcome = await runtime.closeMobileSessionTab(
        `id:${FLOATING_TERMINAL_WORKTREE_ID}`,
        `agent-session:${current.sessionId}`,
        { reason: 'user' }
      )
      if (
        outcome.refused ||
        host.getSessionTabId(current.sessionId) ||
        !structuredSessionCloseSettled(current.sessionId)
      ) {
        throw new AgentHubError('invalid_argument', 'Orb conversation could not be closed')
      }
    } catch (error) {
      if (
        !host.getSessionTabId(current.sessionId) &&
        !structuredSessionCloseSettled(current.sessionId)
      ) {
        const agent = host.deps.store.getRecord(current.sessionId)?.provider
        if (isStructuredAgentId(agent)) {
          await host.setSessionTabVisibility(current.sessionId, true, tabId)
          await runtime.publishStructuredAgentSessionTab({
            workspaceId: FLOATING_TERMINAL_WORKTREE_ID,
            sessionId: current.sessionId,
            agent,
            activate: false
          })
        }
      }
      throw error
    }
  }
  if (structuredSessionCloseSettled(current.sessionId)) {
    const operations = readOrbOperations(runtime)
    for (const event of operations?.snapshot() ?? []) {
      if (event.orbOperation?.sessionId === current.sessionId) {
        operations?.release(event.orbOperation.id)
      }
    }
  }
}
