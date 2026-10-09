import { useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { nativeChatApprovalAcceptKey } from '../../../../shared/native-chat-agent-support'
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

export type AgentHubQuickAnswer = {
  /** The one-keystroke answers; empty for a prompt that needs the full card (several questions). */
  options: readonly AgentHubQuickOption[]
  /** The answer already given, here or on the hub's card. */
  chosen: number | null
  canAnswer: boolean
  /** Sends option `index`; false when nothing was sent. */
  choose: (index: number) => boolean
}

const FINISH_ANSWER_AFTER_UNMOUNT = { finishAnswerAfterUnmount: true }

/**
 * The hub card's answer path for a small surface (an alert bubble, a pane overlay): the same
 * keys reach the agent, and the answer is shared with the card so neither answers twice.
 */
export function useAgentHubQuickAnswer(thread: AgentPaneThread): AgentHubQuickAnswer {
  const { paneKey } = thread
  const tabId = thread.tab.id
  const interactivePrompt = useAppStore(
    (s) => s.agentStatusByPaneKey[paneKey]?.interactivePrompt ?? null
  )
  const toolName = useAppStore((s) => {
    const entry = s.agentStatusByPaneKey[paneKey]
    return entry?.interactivePrompt ? (entry.toolName ?? null) : null
  })
  const card = useMemo(
    () => parseInteractivePrompt(interactivePrompt, toolName ?? undefined, thread.agentType),
    [interactivePrompt, toolName, thread.agentType]
  )
  const ptyId = useAgentHubLivePty(thread.worktree.id, tabId, paneKey, false)
  const send = useNativeChatInteractiveSend(
    tabId,
    paneKey,
    ptyId,
    thread.agentType,
    FINISH_ANSWER_AFTER_UNMOUNT
  )
  const canSend = useNativeChatCanSend(ptyId)
  const cardKey = agentHubCardKey(paneKey, agentHubStateSince(thread))
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
  const choose = (index: number): boolean => {
    const option = options[index]
    if (!option || !canAnswer || chosen !== null) {
      return false
    }
    recordAgentHubCardAnswer(cardKey, index)
    setAnswered({ key: cardKey, index })
    if (simpleQuestion && card?.kind === 'question') {
      // A refused or lost delivery hands the answer back for another try.
      send.sendAnswer(card.prompt, [{ indices: [index] }], (delivered) => {
        if (!delivered) {
          recordAgentHubCardAnswer(cardKey, null)
          setAnswered(null)
        }
      })
    } else if (option.deny) {
      send.cancelAsk()
    } else {
      send.sendRaw(nativeChatApprovalAcceptKey(thread.agentType))
    }
    return true
  }
  return { options, chosen, canAnswer, choose }
}
