import { useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { nativeChatApprovalAcceptKey } from '../../../../shared/native-chat-agent-support'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { useNativeChatCanSend } from '../native-chat/use-native-chat-can-send'
import { useNativeChatInteractiveSend } from '../native-chat/use-native-chat-interactive-send'
import { questionOptions } from './AgentHubAnswerBody'
import {
  agentHubCardKey,
  readAnsweredAgentHubCard,
  recordAgentHubCardAnswer
} from './agent-hub-answered-cards'
import { agentHubStateSince } from './agent-hub-lists'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'

export type AgentHubQuickOption = {
  id: string
  label: React.ReactNode
  recommended?: boolean
  /** Declines the approval. */
  deny?: boolean
}

/** The pane an answer goes to, as a thread or a bare status entry describes it. */
export type AgentHubQuickAnswerTarget = {
  worktreeId: string
  tabId: string
  paneKey: string
  agentType: AgentType
  /** When the prompt began; one answer per prompt is shared with the hub card by it. */
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

export type AgentHubQuickAnswer = {
  /** What is being asked: the question, or the command awaiting approval. */
  question: string | null
  /** The one-keystroke answers; empty for a prompt that needs the full card (several questions). */
  options: readonly AgentHubQuickOption[]
  /** The answer already given, here or on the hub's card. */
  chosen: number | null
  canAnswer: boolean
  /** Sends option `index`; false when nothing was sent. */
  choose: (index: number) => boolean
  /** Answers a question in the user's own words; null for an approval. */
  reply: ((text: string) => boolean) | null
}

const FINISH_ANSWER_AFTER_UNMOUNT = { finishAnswerAfterUnmount: true }

/**
 * The hub card's answer path for a small surface (an alert bubble, a pane overlay): the same
 * keys reach the agent, and the answer is shared with the card so neither answers twice.
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
    tabId,
    paneKey,
    ptyId,
    agentType,
    FINISH_ANSWER_AFTER_UNMOUNT
  )
  const canSend = useNativeChatCanSend(ptyId)
  const cardKey = agentHubCardKey(paneKey, target.stateSince)
  // Why two: the shared record clears once the agent moves on, while this surface keeps showing
  // what it just sent until it goes away.
  const [answered, setAnswered] = useState<{ key: string; index: number } | null>(null)
  const chosen = answered?.key === cardKey ? answered.index : readAnsweredAgentHubCard(cardKey)

  const question =
    card?.kind === 'question' && card.prompt.questions.length === 1
      ? (card.prompt.questions[0] ?? null)
      : null
  const simpleQuestion = question && !question.multiSelect ? question : null
  const approval = card?.kind === 'approval' ? card.approval : null
  const options = useMemo<AgentHubQuickOption[]>(() => {
    if (simpleQuestion) {
      return questionOptions(simpleQuestion)
    }
    if (approval) {
      return [
        { id: 'allow-once', label: translate('agentHub.card.allowOnce', 'Yes, run it once') },
        { id: 'deny', label: translate('agentHub.quick.deny', 'No'), deny: true }
      ]
    }
    return []
  }, [simpleQuestion, approval])

  const canAnswer = card !== null && ptyId !== null && canSend
  const questionText = simpleQuestion?.question ?? approval?.detail ?? approval?.title ?? null
  const answerQuestion = (
    selections: Parameters<typeof send.sendAnswer>[1],
    marker: number
  ): boolean => {
    if (!simpleQuestion || card?.kind !== 'question' || !canAnswer || chosen !== null) {
      return false
    }
    recordAgentHubCardAnswer(cardKey, marker)
    setAnswered({ key: cardKey, index: marker })
    // A refused or lost delivery hands the answer back for another try.
    send.sendAnswer(card.prompt, selections, (delivered) => {
      if (!delivered) {
        recordAgentHubCardAnswer(cardKey, null)
        setAnswered(null)
      }
    })
    return true
  }
  const choose = (index: number): boolean => {
    const option = options[index]
    if (!option || !canAnswer || chosen !== null) {
      return false
    }
    if (simpleQuestion) {
      return answerQuestion([{ indices: [index] }], index)
    }
    recordAgentHubCardAnswer(cardKey, index)
    setAnswered({ key: cardKey, index })
    if (option.deny) {
      send.cancelAsk()
    } else {
      send.sendRaw(nativeChatApprovalAcceptKey(agentType))
    }
    return true
  }
  // Why -1: the card marks a free-text answer the same way, so neither answers twice.
  const reply = simpleQuestion
    ? (text: string): boolean =>
        text.trim() !== '' && answerQuestion([{ indices: [], other: text }], -1)
    : null
  return { question: questionText, options, chosen, canAnswer, choose, reply }
}
