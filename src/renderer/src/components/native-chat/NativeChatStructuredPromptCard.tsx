import type { RefObject } from 'react'
import {
  agentSessionPromptQuestions,
  type AgentSessionPromptResponse
} from '../../../../shared/agent-session-question-answer'
import { NativeChatApprovalCard, type NativeChatApprovalCardProps } from './NativeChatApprovalCard'
import { NativeChatStructuredQuestionCard } from './NativeChatStructuredQuestionCard'
import { chatApprovalFromJournal } from '../../../../shared/native-chat-interactive-prompt'
import type { StructuredPromptItem } from '../../../../shared/structured-agent-session-message-projection'

export function NativeChatStructuredPromptCard({
  prompt,
  onAnswer,
  onCancel,
  isSubmitting,
  shouldFocus,
  answerInputRef,
  multiline,
  onLinkClick
}: {
  prompt: StructuredPromptItem
  onAnswer: (response: AgentSessionPromptResponse) => void
  onCancel: () => void
  isSubmitting: boolean
  shouldFocus: boolean
  answerInputRef: RefObject<HTMLInputElement | null>
  multiline: boolean
  onLinkClick: NativeChatApprovalCardProps['onLinkClick']
}): React.JSX.Element | null {
  if (prompt.body.kind === 'approval') {
    return (
      <NativeChatApprovalCard
        approval={chatApprovalFromJournal(prompt.body)}
        onChoose={(optionId) => onAnswer({ kind: 'option', optionId })}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        shouldFocus={shouldFocus}
        onLinkClick={onLinkClick}
        allowFileUriLinks={onLinkClick !== undefined}
      />
    )
  }
  if (prompt.body.kind === 'question') {
    return (
      <NativeChatStructuredQuestionCard
        multiline={multiline}
        questions={agentSessionPromptQuestions(prompt.body)}
        onAnswer={onAnswer}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        shouldFocus={shouldFocus}
        answerInputRef={answerInputRef}
      />
    )
  }
  return null
}
