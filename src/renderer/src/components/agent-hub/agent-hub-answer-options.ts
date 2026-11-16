import { translate } from '@/i18n/i18n'
import type { AskQuestion } from '../../../../shared/native-chat/input/questions/native-chat-ask-types'
import { splitRecommendedOptionLabel } from '../native-chat/native-chat-option-label'

export type AgentHubAnswerOption = {
  /** Stable React key; the option's position is what gets sent. */
  id: string
  label: React.ReactNode
  description?: string
  /** The agent's own pick, as its label marked it. */
  recommended?: boolean
  /** Declines; muted styling. */
  deny?: boolean
}

/** A question's options as the card shows them: the "(Recommended)" suffix becomes a badge. */
export function questionOptions(question: AskQuestion): AgentHubAnswerOption[] {
  return question.options.map((option, index) => {
    const { label, recommended } = splitRecommendedOptionLabel(option.label)
    return { id: `${index}:${option.label}`, label, recommended, description: option.description }
  })
}

/** The two answers every approval takes from a small surface: run it once, or decline. */
export function approvalQuickOptions(): AgentHubAnswerOption[] {
  return [
    { id: 'allow-once', label: translate('agentHub.card.allowOnce', 'Yes, run it once') },
    { id: 'deny', label: translate('agentHub.quick.deny', 'No'), deny: true }
  ]
}
