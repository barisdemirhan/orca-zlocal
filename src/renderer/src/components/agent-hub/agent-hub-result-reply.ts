import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { sendMessageToAgent } from '@/lib/agent-session/messaging/agent-message-send'
import { deriveNotesSendAgentTargets } from '@/lib/agent-session/messaging/notes-send-agent-targets'
import { activeAgentNotesSendFailureMessage } from '@/lib/agent-session/messaging/terminal/active-agent-note-send-result'
import { getStructuredChatTabNames } from '@/runtime/native-chat/naming/structured-chat-name-observation'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'

/** Sends a follow-up to a finished agent through the notes send, in its terminal or chat. */
export async function replyToFinishedAgent(
  thread: AgentPaneThread,
  text: string
): Promise<boolean> {
  const worktreeId = thread.worktree.id
  const agent = deriveNotesSendAgentTargets(
    useAppStore.getState(),
    worktreeId,
    getStructuredChatTabNames()
  ).find((candidate) => candidate.tabId === thread.tab.id)
  const result =
    agent && agent.status === 'eligible'
      ? await sendMessageToAgent({ worktreeId, target: agent.messageTarget, prompt: text })
      : null
  if (result?.status === 'sent' || result?.status === 'unconfirmed') {
    return true
  }
  toast.error(
    result
      ? activeAgentNotesSendFailureMessage(result.status, {
          code: result.code,
          explicitTarget: true
        })
      : translate('agentHub.inbox.replyFailed', 'Could not send your reply. Try again.')
  )
  return false
}
