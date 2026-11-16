import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { nativeChatApprovalAcceptKey } from '../../../../shared/native-chat/native-chat-agent-support'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AskQuestion } from '../../../../shared/native-chat/input/questions/native-chat-ask-types'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { parseInteractivePrompt } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { sayNativeChatApprovalTranslated } from '../native-chat/prompts/native-chat-interactive-prompt'
import { useNativeChatCanSend } from '../native-chat/host-access/use-native-chat-can-send'
import { useNativeChatInteractiveSend } from '../native-chat/session/terminal/send/use-native-chat-interactive-send'
import {
  approvalQuickOptions,
  questionOptions,
  type AgentHubAnswerOption
} from './agent-hub-answer-options'
import {
  agentHubCardKey,
  readAnsweredAgentHubCard,
  recordAgentHubCardAnswer,
  useAnsweredAgentHubCard,
  useAgentHubCardAnswerPending
} from './agent-hub-answered-cards'
import { agentHubStateSince } from './agent-hub-lists'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'

/** A key pressed as a card appears was meant for whatever it replaced. */
export const AGENT_HUB_CARD_KEY_GUARD_MS = 400
/** How long an answered small surface stays, so what went out can be read. */
export const AGENT_HUB_ANSWERED_VISIBLE_MS = 1000

const FINISH_ANSWER_AFTER_UNMOUNT = { finishAnswerAfterUnmount: true }

/** The pane an answer goes to, as a thread or a bare status entry describes it. */
export type AgentHubQuickAnswerTarget = {
  worktreeId: string
  tabId: string
  paneKey: string
  agentType: AgentType
  /** When the prompt began; one answer per prompt is shared across surfaces by it. */
  stateSince: number
}

export function quickAnswerTargetOf(thread: AgentPaneThread): AgentHubQuickAnswerTarget {
  return {
    worktreeId: thread.worktree.id,
    tabId: thread.tab.id,
    paneKey: thread.paneKey,
    agentType: thread.agentType,
    stateSince: agentHubStateSince(thread)
  }
}

type ParsedCard = ReturnType<typeof parseInteractivePrompt>
type Send = ReturnType<typeof useNativeChatInteractiveSend>

export type AgentHubQuickAnswer = {
  card: ParsedCard
  /** A lone single-choice question; the one shape the small surfaces answer in full. */
  simpleQuestion: AskQuestion | null
  approval: Extract<NonNullable<ParsedCard>, { kind: 'approval' }>['approval'] | null
  /** What is being asked: the question, or the command awaiting approval. */
  question: string | null
  /** The one-keystroke answers; empty for a prompt that needs the full card (several questions). */
  options: readonly AgentHubAnswerOption[]
  /** The answer on record for this prompt, from any surface. */
  chosen: number | null
  pending: boolean
  canAnswer: boolean
  ptyId: string | null
  send: Send
  cardKey: string
  /** Sends option `index`; false when nothing was sent. */
  choose: (index: number, onDeliverySettled?: (delivered: boolean) => void) => boolean
  /** `choose` for a number key: refused while the surface has just appeared. */
  chooseByKey: (index: number, onDeliverySettled?: (delivered: boolean) => void) => boolean
  /** Whether a number key would be taken right now. */
  keysArmed: () => boolean
  /** Answers a single question in the user's own words; false for anything else. */
  reply: (text: string, onDeliverySettled?: (delivered: boolean) => void) => boolean
  /** A null key denies; only an acknowledged write completes the answer. */
  answerApproval: (index: number, key: string | null) => Promise<boolean> | null
}

/**
 * The one answer path for a prompt, shared by the hub card, the alert bubble and the pane
 * card: the same keys reach the agent, and the answer is on one record so no surface answers
 * a prompt twice.
 */
export function useAgentHubQuickAnswer(target: AgentHubQuickAnswerTarget): AgentHubQuickAnswer {
  const { paneKey, tabId, agentType } = target
  const interactivePrompt = useAppStore(
    (s) => s.agentStatusByPaneKey.get(paneKey)?.interactivePrompt ?? null
  )
  const toolName = useAppStore((s) => {
    const entry = s.agentStatusByPaneKey.get(paneKey)
    return entry?.interactivePrompt ? (entry.toolName ?? null) : null
  })
  const card = useMemo(
    () =>
      parseInteractivePrompt(
        interactivePrompt,
        toolName ?? undefined,
        agentType,
        sayNativeChatApprovalTranslated
      ),
    [interactivePrompt, toolName, agentType]
  )
  const ptyId = useAgentHubLivePty(target.worktreeId, tabId, paneKey, false)
  const send = useNativeChatInteractiveSend(paneKey, ptyId, agentType, FINISH_ANSWER_AFTER_UNMOUNT)
  // Why canSend: a mobile-owned PTY refuses desktop input, as in the chat composer.
  const canSend = useNativeChatCanSend(ptyId)
  const cardKey = agentHubCardKey(paneKey, target.stateSince, interactivePrompt)
  const chosen = useAnsweredAgentHubCard(cardKey)
  const pending = useAgentHubCardAnswerPending(cardKey)
  // Why in an effect: the guard starts once the surface is on screen; until then no key is taken.
  const shownAt = useRef(Number.POSITIVE_INFINITY)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [])

  const question =
    card?.kind === 'question' && card.prompt.questions.length === 1
      ? (card.prompt.questions[0] ?? null)
      : null
  const simpleQuestion = question && !question.multiSelect ? question : null
  const approval = card?.kind === 'approval' ? card.approval : null
  const options = useMemo<AgentHubAnswerOption[]>(
    () =>
      simpleQuestion ? questionOptions(simpleQuestion) : approval ? approvalQuickOptions() : [],
    [simpleQuestion, approval]
  )
  const canAnswer = card !== null && ptyId !== null && canSend
  // Why re-read: another surface may have answered since this one rendered.
  const open = (): boolean => canAnswer && !pending && readAnsweredAgentHubCard(cardKey) === null

  const answerQuestion = (
    selections: Parameters<Send['sendAnswer']>[1],
    marker: number,
    onDeliverySettled?: (delivered: boolean) => void
  ): boolean => {
    if (!simpleQuestion || card?.kind !== 'question' || !open()) {
      return false
    }
    const settle = recordAgentHubCardAnswer(cardKey, marker, true)
    // A refused or lost delivery hands the answer back for another try.
    const result = send.sendAnswer(card.prompt, selections, (delivered) => {
      if (settle(delivered)) {
        onDeliverySettled?.(delivered)
      }
    })
    if (result.settleAfterMs <= 0) {
      settle(false)
      return false
    }
    return true
  }
  const answerApproval = (index: number, key: string | null): Promise<boolean> | null => {
    if (!approval || !open()) {
      return null
    }
    const settle = recordAgentHubCardAnswer(cardKey, index, true)
    return Promise.resolve()
      .then(() => (key === null ? send.cancelAsk() : send.sendRawVerified(key)))
      .catch(() => false)
      .then((delivered) => {
        const current = settle(delivered)
        if (current && !delivered) {
          toast.error(
            translate('agentHub.requests.sendFailed', 'Could not send your answer. Try again.')
          )
        }
        return current && delivered
      })
  }
  const choose = (index: number, onDeliverySettled?: (delivered: boolean) => void): boolean => {
    const option = options[index]
    if (!option || !open()) {
      return false
    }
    if (simpleQuestion) {
      return answerQuestion([{ indices: [index] }], index, onDeliverySettled)
    }
    const delivery = answerApproval(
      index,
      option.deny ? null : nativeChatApprovalAcceptKey(agentType)
    )
    if (!delivery) {
      return false
    }
    void delivery.then((delivered) => onDeliverySettled?.(delivered))
    return true
  }
  const keysArmed = (): boolean =>
    performance.now() - shownAt.current >= AGENT_HUB_CARD_KEY_GUARD_MS
  const fullCardSend: Send = {
    ...send,
    sendAnswer: (prompt, selections, onDeliverySettled) => {
      if (card?.kind !== 'question' || !open()) {
        return { settleAfterMs: 0 }
      }
      const settle = recordAgentHubCardAnswer(cardKey, -1, true)
      const result = send.sendAnswer(prompt, selections, (delivered) => {
        if (settle(delivered)) {
          onDeliverySettled?.(delivered)
        }
      })
      if (result.settleAfterMs <= 0) {
        settle(false)
      }
      return result
    },
    cancelAsk: () => {
      if (card?.kind !== 'question' || !open()) {
        return Promise.resolve(false)
      }
      const settle = recordAgentHubCardAnswer(cardKey, -1, true)
      return send
        .cancelAsk()
        .catch(() => false)
        .then((delivered) => settle(delivered) && delivered)
    }
  }
  return {
    card,
    simpleQuestion,
    approval,
    question: simpleQuestion?.question ?? approval?.detail ?? approval?.title ?? null,
    options,
    chosen,
    pending,
    canAnswer,
    ptyId,
    send: fullCardSend,
    cardKey,
    choose,
    chooseByKey: (index, onDeliverySettled) => keysArmed() && choose(index, onDeliverySettled),
    keysArmed,
    // Why -1: the card marks a free-text answer the same way, so neither answers twice.
    reply: (text, onDeliverySettled) =>
      text.trim() !== '' && answerQuestion([{ indices: [], other: text }], -1, onDeliverySettled),
    answerApproval
  }
}
