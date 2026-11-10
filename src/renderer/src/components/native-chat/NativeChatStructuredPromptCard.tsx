import type { RefObject } from 'react'
import {
  agentSessionPromptQuestions,
  type AgentSessionPromptResponse
} from '../../../../shared/agent-session/agent-session-question-answer'
import { NativeChatApprovalCard } from './prompts/NativeChatApprovalCard'
import { NativeChatStructuredQuestionCard } from './prompts/NativeChatStructuredQuestionCard'
import { chatApprovalFromJournal } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import type { StructuredPromptItem } from '../../../../shared/agent-session/view/structured-agent-session-message-projection'

export function NativeChatStructuredPromptCard({
  prompt,
  onAnswer,
  onCancel,
  isSubmitting,
  shouldFocus,
  answerInputRef,
  multiline
}: {
  prompt: StructuredPromptItem
  onAnswer: (response: AgentSessionPromptResponse) => void
  onCancel: () => void
  isSubmitting: boolean
  shouldFocus: boolean
  answerInputRef: RefObject<HTMLTextAreaElement | null>
  multiline: boolean
}): React.JSX.Element | null {
  if (prompt.body.kind === 'approval') {
    return (
      <NativeChatApprovalCard
        approval={chatApprovalFromJournal(prompt.body)}
        onChoose={(optionId) => onAnswer({ kind: 'option', optionId })}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        shouldFocus={shouldFocus}
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
