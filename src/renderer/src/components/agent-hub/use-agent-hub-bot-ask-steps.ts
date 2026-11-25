// A bot item's waiting ask as one model for every Agent Hub surface (rows, bubble, chat card, Orb): the
// item's own read, pending comments and question steps (the ones the Items panel uses), so held answers
// show the same everywhere and a reply posts through the bot's own host.
import { useEffect, useState } from 'react'
import { useLatestHandler } from '@/lib/use-latest-handler'
import { useBotItemPendingComments } from '../bots/items/use-bot-item-pending-comments'
import { useBotItemQuestionSteps } from '../bots/items/use-bot-item-question-steps'
import { useBotItemView } from '../bots/items/use-bot-item-view'
import { botItemAnswerWords } from '../../../../shared/bots/bot-item-answer-lines'
import { botItemWaitingAsk } from '../../../../shared/bots/bot-item-question-answers'
import type {
  BotItemDecision,
  BotItemQuestionShape,
  BotItemQuickReply
} from '../../../../shared/bots/bot-item-ask'
import type { Bot } from '../../../../shared/bot-types'
import type { BotItem } from '../../../../shared/bots/bot-items'
import type { BotItemQuestionStepsSend } from '../../../../shared/bots/use-bot-item-question-steps'
import { agentHubBotAskLine } from './use-agent-hub-bot-ask'

const NO_REPLIES: readonly BotItemQuickReply[] = []

/** `closed`: nothing waits on the owner here (and nothing was answered in this view). */
export type AgentHubBotAskPhase = 'reading' | 'failed' | 'open' | 'answered' | 'closed'

export type AgentHubBotAskModel = {
  phase: AgentHubBotAskPhase
  number: number
  title: string
  /** The ask's question lines (at least one). */
  total: number
  /** The other lines that are answered or held, as "Question → answer". */
  folded: readonly { index: number; question: string; words: string; reopens: boolean }[]
  /** Names the open question: a view keeps its typed words and picks per key. */
  openKey: string
  question: string
  replies: readonly BotItemQuickReply[]
  /** Several replies can be picked before they answer together. */
  multi: boolean
  /** The words held for the open question, not sent yet. */
  held: string | null
  /** Where the open line is among several: null with one. */
  nav: { at: number; count: number } | null
  answeredCount: number
  heldCount: number
  step: (delta: -1 | 1) => void
  reopen: (index: number) => void
  /** Answers the open question with these replies' words (several joined as one answer). */
  pick: (labels: readonly string[]) => void
  /** The owner's own words for the open question. */
  reply: (text: string) => void
  sendHeld: () => void
  retry: () => void
}

/** What the list's row knows of the ask until its events are read. */
function listedShape(item: BotItem): BotItemQuestionShape {
  const question = item.question
  return { body: question?.gist ?? '', decisions: question?.decisions ?? [] }
}

export function useAgentHubBotAskSteps(bot: Bot, item: BotItem): AgentHubBotAskModel {
  const view = useBotItemView(bot, item.uid, item)
  const live = view.item ?? item
  const pending = useBotItemPendingComments(bot, item.uid, view.events)
  // As the panel's comment box sends: after the newest event read, naming the question it answers.
  const send = useLatestHandler<Parameters<BotItemQuestionStepsSend>, void>(
    (text, paths = [], ...rest) =>
      pending.send(text, paths, view.events.at(-1)?.id ?? live.lastEventId, ...rest)
  )
  const { steps, sent, quick, fromBox, waitingLine } = useBotItemQuestionSteps(
    bot,
    live,
    view.events,
    send,
    pending.shown
  )
  const asked = botItemWaitingAsk(live, view.events)
  // The waiting ask can be older than the loaded page: earlier pages load until its comment shows.
  const askId = live.waitingAsk ?? live.question?.eventId
  const askUnread =
    view.eventsRead && askId !== undefined && !view.events.some((event) => event.id === askId)
  const { hasEarlier, loadEarlier } = view
  const earliest = view.events[0]?.id
  useEffect(() => {
    if (askUnread && hasEarlier) {
      loadEarlier()
    }
  }, [askUnread, hasEarlier, earliest, loadEarlier])

  const shape = steps?.shape ?? asked?.shape ?? listedShape(live)
  const total = Math.max(1, shape.decisions.length)
  const lineIndex = steps?.current ?? 0
  const decision: BotItemDecision | undefined = shape.decisions[lineIndex]
  const question = decision?.question ?? waitingLine?.line ?? agentHubBotAskLine(live)

  const sentAll = sent
    ? sent.answers.filter(Boolean).length >= (steps ? steps.lines.length : total)
    : false
  const postingOne = !steps && pending.shown.some(({ failed }) => !failed)
  const open = asked !== null && !sentAll && !postingOne
  const [seenOpen, setSeenOpen] = useState(false)
  if (open && !seenOpen) {
    setSeenOpen(true)
  }
  const phase: AgentHubBotAskPhase = open
    ? 'open'
    : asked !== null || seenOpen
      ? 'answered'
      : view.eventsRead
        ? 'closed'
        : view.failed
          ? 'failed'
          : 'reading'

  const folded =
    steps && asked
      ? shape.decisions.flatMap((line, index) => {
          const reply = asked.answers[index]
          const posted =
            reply && !steps.lines.includes(index) && !asked.byOrder[index]
              ? botItemAnswerWords(shape, index, reply.data)
              : null
          const words = index === lineIndex ? null : (posted ?? steps.held[index])
          return words ? [{ index, question: line.question, words, reopens: !posted }] : []
        })
      : []
  const at = steps ? steps.lines.indexOf(steps.current) : 0
  const held = steps ? (steps.held[steps.current] ?? null) : null
  const answeredCount = steps
    ? total - steps.lines.filter((line) => !steps.held[line]).length
    : phase === 'answered'
      ? total
      : 0

  return {
    phase,
    number: live.number,
    title: live.title,
    total,
    folded,
    openKey: `${steps?.askId ?? askId ?? ''}:${lineIndex}`,
    question,
    replies: decision?.replies ?? NO_REPLIES,
    multi: decision?.multi === true,
    held,
    nav: steps ? { at, count: steps.lines.length } : null,
    answeredCount,
    heldCount: steps?.heldCount ?? 0,
    step: (delta) => {
      const target = steps?.lines[at + delta]
      if (steps && target !== undefined) {
        steps.go(target)
      }
    },
    reopen: (index) => steps?.go(index),
    pick: (labels) => {
      const words = labels.join(', ')
      if (steps) {
        steps.answer(steps.current, words)
      } else {
        quick(words)
      }
    },
    reply: (text) => fromBox(text, [], waitingLine?.id ?? null),
    sendHeld: () => steps?.sendHeld(),
    retry: view.retry
  }
}
