import type { AgentJournalRenderItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { StructuredPromptItem } from '../../../../shared/agent-session/view/structured-agent-session-message-projection'
import { agentHubAskRequest } from './agent-hub-request-test-fixtures'

export function orbAsk(sessionId = 'orb-session') {
  const request = agentHubAskRequest()
  return { ...request, caller: { ...request.caller, kind: 'orb' as const, sessionId } }
}

export function orbMessage(
  text: string,
  at: number,
  role: 'assistant' | 'user' = 'assistant'
): AgentJournalRenderItem {
  return {
    itemId: `message-${at}`,
    revision: 1,
    sequence: at,
    observedAt: at,
    body: { kind: 'message', role, blocks: [{ type: 'text', text }] }
  }
}

export function orbApproval(): StructuredPromptItem {
  return {
    itemId: 'approval',
    revision: 2,
    sequence: 2,
    observedAt: 100_000,
    body: {
      kind: 'approval',
      title: 'Allow command?',
      detail: 'pnpm test',
      options: [
        { id: 'allow', label: 'Allow', permissionKind: 'allow_once' },
        { id: 'deny', label: 'Deny', permissionKind: 'reject_once' }
      ],
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    }
  }
}
