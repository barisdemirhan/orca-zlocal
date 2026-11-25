import { useAppStore } from '@/store'
import { sendMessageToAgent } from '@/lib/agent-session/messaging/agent-message-send'
import { deriveNotesSendAgentTargets } from '@/lib/agent-session/messaging/notes-send-agent-targets'
import { getStructuredChatTabNames } from '@/runtime/native-chat/naming/structured-chat-name-observation'
import { workspaceChatTargetFor } from '../native-chat/selection-quotes/native-chat-workspace-selection'
import { appendQuoteToChatDraft } from '../native-chat/drafts/native-chat-selection-quote-draft'

/**
 * Leaves the text unsent in this card's own agent: a chat's composer draft, or a plain terminal
 * agent's input through the notes send's guarded paste without its Enter. Never starts an agent.
 */
export async function draftTextForMirrorAgent(
  card: { worktreeId: string; tabId: string },
  text: string
): Promise<boolean> {
  const state = useAppStore.getState()
  const { worktreeId } = card
  const agent = deriveNotesSendAgentTargets(state, worktreeId, getStructuredChatTabNames()).find(
    (candidate) => candidate.tabId === card.tabId
  )
  if (!agent || agent.status !== 'eligible') {
    return false
  }
  const chat = workspaceChatTargetFor(state, worktreeId, agent.messageTarget)
  if (chat) {
    appendQuoteToChatDraft(chat.scopeKey, text)
    return true
  }
  const result = await sendMessageToAgent({
    worktreeId,
    target: agent.messageTarget,
    prompt: text,
    submit: false
  })
  return result.status === 'sent'
}
