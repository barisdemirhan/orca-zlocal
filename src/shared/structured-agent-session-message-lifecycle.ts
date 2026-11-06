import {
  AGENT_JOURNAL_MESSAGE_STATES,
  type AgentJournalMessageItem
} from './agent-session/journal/agent-session-journal-types'
import type { NativeChatMessage } from './native-chat/native-chat-types'

/** A state this build cannot name reads as completed: a newer host's row is never live here. */
export function structuredMessageLifecycle(
  body: AgentJournalMessageItem
): Pick<NativeChatMessage, 'state' | 'completedAt'> {
  const state: string | undefined = body.state
  if (state === undefined) {
    return {}
  }
  return {
    state: AGENT_JOURNAL_MESSAGE_STATES.find((known) => known === state) ?? 'completed',
    ...(body.completedAt !== undefined ? { completedAt: body.completedAt } : {})
  }
}
