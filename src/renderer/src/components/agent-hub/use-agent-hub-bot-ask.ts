import { useMemo, useState } from 'react'
import { useBotItemPendingComments } from '../bots/items/use-bot-item-pending-comments'
import {
  botItemQuestionLine,
  botItemQuickReplyText,
  type BotItemDecision
} from '../../../../shared/bots/bot-item-ask'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem, BotItemEvent } from '../../../../shared/bots/bot-items'
import type { AgentHubAnswerOption } from './agent-hub-answer-options'

const NO_EVENTS: readonly BotItemEvent[] = []

/** The one decision a chip can answer: a single, pick-one question that offers quick replies. */
function answerableDecision(item: BotItem): BotItemDecision | null {
  const decisions = item.question?.decisions ?? []
  const [only] = decisions
  return decisions.length === 1 && only && !only.multi && only.replies.length > 0 ? only : null
}

/** A bot item's question as one line, whatever shape the host sent it in. */
export function agentHubBotAskLine(item: BotItem): string {
  const question = item.question
  return botItemQuestionLine(
    question?.decisions?.[0]?.question ?? question?.gist ?? question?.text ?? item.title
  )
}

/**
 * Answers a bot item's ask the way its panel does: the quick reply posts as the owner's comment
 * bound to the question, through the bot's own host. Asks with several questions or free text
 * have no chips and are answered in the bot's Home.
 */
export function useAgentHubBotAsk(
  bot: Bot,
  item: BotItem
): {
  options: AgentHubAnswerOption[]
  chosen: number | null
  choose: (index: number, onSent?: () => void) => void
} {
  const pending = useBotItemPendingComments(bot, item.uid, NO_EVENTS)
  const [chosen, setChosen] = useState<number | null>(null)
  const decision = answerableDecision(item)
  const options = useMemo(
    () =>
      (decision?.replies ?? []).map((reply, index) => ({
        id: `${index}:${reply.label}`,
        label: reply.label,
        description: reply.detail,
        recommended: reply.recommended
      })),
    [decision]
  )
  const choose = (index: number, onSent?: () => void): void => {
    const reply = decision?.replies[index]
    const questionId = item.question?.eventId
    if (!decision || !reply || chosen !== null || questionId === undefined) {
      return
    }
    setChosen(index)
    pending.send(
      botItemQuickReplyText({ body: '', decisions: [decision] }, decision, reply),
      [],
      item.lastEventId,
      questionId
    )
    onSent?.()
  }
  return { options, chosen, choose }
}
