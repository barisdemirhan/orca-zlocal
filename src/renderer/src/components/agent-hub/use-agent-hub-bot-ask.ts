import { botItemQuestionLine } from '../../../../shared/bots/bot-item-ask'
import type { BotItem } from '../../../../shared/bots/bot-items'

/** A bot item's question as one line, whatever shape the host sent it in. */
export function agentHubBotAskLine(item: BotItem): string {
  const question = item.question
  return botItemQuestionLine(
    question?.decisions?.[0]?.question ?? question?.gist ?? question?.text ?? item.title
  )
}
