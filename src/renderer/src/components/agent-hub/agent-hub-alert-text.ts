import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import { parseInteractivePrompt } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { sayNativeChatApprovalTranslated } from '../native-chat/prompts/native-chat-interactive-prompt'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import type { AgentHubThreadAlert } from './agent-hub-alerts'

/** What an agent alert says: the open question, the approval's detail, or its last message. */
export function agentHubAlertText(alert: AgentHubThreadAlert): string {
  const entry = alert.thread.currentAgentEntry ?? alert.thread.paneEntry
  if (alert.kind !== 'done') {
    const card = parseInteractivePrompt(
      entry?.interactivePrompt,
      entry?.toolName,
      undefined,
      sayNativeChatApprovalTranslated
    )
    if (card?.kind === 'question') {
      return card.prompt.questions[0]?.question ?? ''
    }
    if (card?.kind === 'approval') {
      return card.approval.detail ?? card.approval.title
    }
  }
  const message = entry?.lastAssistantMessageIsToolOutput
    ? null
    : entry?.lastAssistantMessage?.trim()
  return message ? agentHubMessageSummary(message) : activityThreadRowCopy(alert.thread).statusLine
}
