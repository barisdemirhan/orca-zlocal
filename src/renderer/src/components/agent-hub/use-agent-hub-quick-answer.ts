import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import { nativeChatApprovalAcceptKey } from '../../../../shared/native-chat-agent-support'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { AskQuestion } from '../../../../shared/native-chat-ask-types'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { useNativeChatCanSend } from '../native-chat/use-native-chat-can-send'
import { useNativeChatInteractiveSend } from '../native-chat/use-native-chat-interactive-send'
import {
  approvalQuickOptions,
  questionOptions,
  type AgentHubAnswerOption
} from './agent-hub-answer-options'
import {
  agentHubCardKey,
  readAnsweredAgentHubCard,
  recordAgentHubCardAnswer,
  useAnsweredAgentHubCard
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
  canAnswer: boolean
  ptyId: string | null
  send: Send
  cardKey: string
  /** Sends option `index`; false when nothing was sent. */
  choose: (index: number) => boolean
  /** `choose` for a number key: refused while the surface has just appeared. */
  chooseByKey: (index: number) => boolean
  /** Whether a number key would be taken right now. */
  keysArmed: () => boolean
  /** Answers a single question in the user's own words; false for anything else. */
  reply: (text: string) => boolean
  /** Marks an answer a surface sent by itself (the card's approval path). */
  recordChoice: (index: number | null) => void
}

/**
 * The one answer path for a prompt, shared by the hub card, the alert bubble and the pane
 * card: the same keys reach the agent, and the answer is on one record so no surface answers
 * a prompt twice.
 */
export function useAgentHubQuickAnswer(target: AgentHubQuickAnswerTarget): AgentHubQuickAnswer {
  const { paneKey, tabId, agentType } = target
  const interactivePrompt = useAppStore(
    (s) => s.agentStatusByPaneKey[paneKey]?.interactivePrompt ?? null
  )
  const toolName = useAppStore((s) => {
    const entry = s.agentStatusByPaneKey[paneKey]
    return entry?.interactivePrompt ? (entry.toolName ?? null) : null
  })
  const card = useMemo(
    () => parseInteractivePrompt(interactivePrompt, toolName ?? undefined, agentType),
    [interactivePrompt, toolName, agentType]
  )
  const ptyId = useAgentHubLivePty(target.worktreeId, tabId, paneKey, false)
  const send = useNativeChatInteractiveSend(
    paneKey,
    ptyId,
    agentType,
    FINISH_ANSWER_AFTER_UNMOUNT
  )
  // Why canSend: a mobile-owned PTY refuses desktop input, as in the chat composer.
  const canSend = useNativeChatCanSend(ptyId)
  const cardKey = agentHubCardKey(paneKey, target.stateSince)
  const chosen = useAnsweredAgentHubCard(cardKey)
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
  const open = (): boolean => canAnswer && readAnsweredAgentHubCard(cardKey) === null

  const answerQuestion = (
    selections: Parameters<Send['sendAnswer']>[1],
    marker: number
  ): boolean => {
    if (!simpleQuestion || card?.kind !== 'question' || !open()) {
      return false
    }
    recordAgentHubCardAnswer(cardKey, marker)
    // A refused or lost delivery hands the answer back for another try.
    const result = send.sendAnswer(card.prompt, selections, (delivered) => {
      if (!delivered) {
        recordAgentHubCardAnswer(cardKey, null)
      }
    })
    if (result.settleAfterMs <= 0) {
      recordAgentHubCardAnswer(cardKey, null)
      return false
    }
    return true
  }
  const choose = (index: number): boolean => {
    const option = options[index]
    if (!option || !open()) {
      return false
    }
    if (simpleQuestion) {
      return answerQuestion([{ indices: [index] }], index)
    }
    recordAgentHubCardAnswer(cardKey, index)
    if (option.deny) {
      send.cancelAsk()
    } else {
      send.sendRaw(nativeChatApprovalAcceptKey(agentType))
    }
    return true
  }
  const keysArmed = (): boolean =>
    performance.now() - shownAt.current >= AGENT_HUB_CARD_KEY_GUARD_MS
  return {
    card,
    simpleQuestion,
    approval,
    question: simpleQuestion?.question ?? approval?.detail ?? approval?.title ?? null,
    options,
    chosen,
    canAnswer,
    ptyId,
    send,
    cardKey,
    choose,
    chooseByKey: (index) => keysArmed() && choose(index),
    keysArmed,
    // Why -1: the card marks a free-text answer the same way, so neither answers twice.
    reply: (text) => text.trim() !== '' && answerQuestion([{ indices: [], other: text }], -1),
    recordChoice: (index) => recordAgentHubCardAnswer(cardKey, index)
  }
}
