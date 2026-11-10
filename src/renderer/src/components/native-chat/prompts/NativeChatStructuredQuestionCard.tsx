import type { RefObject } from 'react'
import type { AgentJournalQuestion } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionPromptResponse } from '../../../../../shared/agent-session/agent-session-question-answer'
import {
  structuredQuestionAnswers,
  structuredQuestionCard
} from '../../../../../shared/structured-agent-question-card'
import { NativeChatQuestionCard } from './NativeChatQuestionCard'

export function NativeChatStructuredQuestionCard({
  questions,
  onAnswer,
  onCancel,
  isSubmitting,
  shouldFocus,
  answerInputRef,
  multiline = false
}: {
  questions: readonly AgentJournalQuestion[]
  onAnswer: (response: AgentSessionPromptResponse) => void
  onCancel: () => void
  isSubmitting?: boolean
  shouldFocus?: boolean
  answerInputRef?: RefObject<HTMLTextAreaElement | null>
  multiline?: boolean
}): React.JSX.Element {
  const card = structuredQuestionCard(questions)
  return (
    <NativeChatQuestionCard
      layout={multiline ? 'embedded' : 'composer'}
      prompt={card.prompt}
      allowOther={card.allowOther}
      freeTextInputs={card.freeTextInputs.map((input) => ({
        ...input,
        multiline: input?.multiline ?? multiline
      }))}
      onAnswer={(selections) => {
        const answers = structuredQuestionAnswers(questions, selections)
        if (answers) {
          onAnswer({ kind: 'answers', answers })
        }
      }}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      shouldFocus={shouldFocus}
      answerInputRef={answerInputRef}
    />
  )
}
