import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import {
  NativeChatInteractiveCard,
  type NativeChatInteractiveCardControl
} from '../native-chat/prompts/NativeChatInteractiveCard'
import type { NativeChatInteractiveSend } from '../native-chat/session/terminal/send/use-native-chat-interactive-send'
import { HubAvatar } from './AgentHubStateMarks'
import { HubDictateButton } from './AgentHubDictateButton'
import { useAgentHubQuickAnswer, quickAnswerTargetOf } from './use-agent-hub-quick-answer'
import { useAnsweredAgentHubCard, useAgentHubCardAnswerPending } from './agent-hub-answered-cards'
import type { AgentHubAnswerQueueItem } from './agent-hub-answer-queue-source'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { AgentHubRequestCard } from './AgentHubRequestCard'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { useAgentHubRequests } from './agent-hub-requests-store'
import type { AgentHubCardControl } from './AgentHubAttentionCard'

export function AgentHubAnswerQueueAnswerObserver({
  item,
  onResolved
}: {
  item: Extract<AgentHubAnswerQueueItem, { kind: 'pane' }>
  onResolved: (id: string) => void
}): null {
  const choice = useAnsweredAgentHubCard(item.cardKey)
  const pending = useAgentHubCardAnswerPending(item.cardKey)
  useEffect(() => {
    if (choice !== null && !pending) {
      onResolved(item.id)
    }
  }, [choice, pending, item.id, onResolved])
  return null
}

export function AgentHubAnswerQueueCard({
  item,
  location,
  unavailable,
  controlRef,
  answerInputRef,
  onResolved,
  onSending
}: {
  item: Extract<AgentHubAnswerQueueItem, { kind: 'pane' }>
  location: AgentHubLocation
  unavailable: boolean
  controlRef: React.RefObject<NativeChatInteractiveCardControl | null>
  answerInputRef: React.RefObject<HTMLTextAreaElement | null>
  onResolved: (id: string) => void
  onSending: (id: string, sending?: boolean) => void
}): React.JSX.Element {
  const quick = useAgentHubQuickAnswer({
    ...quickAnswerTargetOf(item.thread),
    stateSince: item.stateSince
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const disabled = unavailable || !quick.canAnswer || quick.pending || quick.chosen !== null
  const allowed = (): boolean => !disabled
  const send: NativeChatInteractiveSend = {
    ...quick.send,
    sendAnswer: (prompt, selections, onSettled) => {
      if (!allowed()) {
        return { settleAfterMs: 0 }
      }
      onSending(item.id)
      const result = quick.send.sendAnswer(prompt, selections, (delivered) => {
        if (!delivered) {
          onSending(item.id, false)
        }
        onSettled?.(delivered)
      })
      if (result.settleAfterMs <= 0) {
        onSending(item.id, false)
      }
      return result
    },
    sendRawVerified: (raw) => {
      if (!allowed()) {
        return Promise.resolve(false)
      }
      onSending(item.id)
      const index =
        item.card.kind === 'approval'
          ? item.card.approval.options.findIndex((option) => option.send === raw)
          : -1
      const delivery =
        index < 0
          ? Promise.resolve(false)
          : (quick.answerApproval(index, raw === '\x1b' ? null : raw) ?? Promise.resolve(false))
      return delivery.then((delivered) => {
        if (!delivered) {
          onSending(item.id, false)
        }
        return delivered
      })
    },
    cancelAsk: () => {
      if (!allowed()) {
        return Promise.resolve(false)
      }
      onSending(item.id)
      return quick.send.cancelAsk().then((delivered) => {
        if (!delivered) {
          onSending(item.id, false)
        }
        return delivered
      })
    }
  }
  const entry = item.thread.currentAgentEntry ?? item.thread.paneEntry
  const context = entry?.lastAssistantMessageIsToolOutput
    ? undefined
    : entry?.lastAssistantMessage?.trim().split('\n').findLast(Boolean)
  return (
    <>
      <div className="flex items-start gap-2.5">
        <HubAvatar agentType={item.thread.agentType} kind="ask" />
        <div className="min-w-0 space-y-1">
          <div className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">@{item.thread.agentType}</span>{' '}
            {translate('agentHub.answerQueue.isAsking', 'is asking')}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{location.project}</Badge>
            {location.workspace ? <Badge variant="outline">{location.workspace}</Badge> : null}
            <Badge variant="outline">{item.hostLabel}</Badge>
          </div>
        </div>
      </div>
      {context ? <p className="line-clamp-2 text-xs text-muted-foreground">{context}</p> : null}
      <fieldset
        disabled={disabled}
        className="min-w-0 disabled:pointer-events-none disabled:opacity-60"
      >
        <NativeChatInteractiveCard
          card={item.card}
          send={send}
          finishAnswerAfterUnmount
          layout="embedded"
          highlightRecommended
          controlRef={controlRef}
          answerInputRef={answerInputRef}
          answerTextareaRef={textareaRef}
          answerAccessory={
            <HubDictateButton
              compact
              targetInputRef={answerInputRef}
              targetTextareaRef={textareaRef}
            />
          }
          onDismiss={() => onResolved(item.id)}
        />
      </fieldset>
    </>
  )
}

export function AgentHubAnswerQueueRequestCard({
  item,
  presentation,
  unavailable,
  controlRef,
  onSending,
  onResolved
}: {
  item: Extract<AgentHubAnswerQueueItem, { kind: 'request' }>
  presentation: AgentHubRequestPresentation
  unavailable: boolean
  controlRef: React.RefObject<AgentHubCardControl | null>
  onSending: (id: string) => void
  onResolved: (id: string) => void
}): React.JSX.Element {
  const answer = useAgentHubRequests()
    .get(item.item.host)
    ?.answerStates.get(item.item.request.requestId)
  useEffect(() => {
    if (answer?.phase === 'answered-elsewhere') {
      onResolved(item.id)
    }
  }, [answer, item.id, onResolved])
  return (
    <fieldset
      disabled={unavailable}
      className="min-w-0 disabled:pointer-events-none disabled:opacity-60"
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest('button')) {
          onSending(item.id)
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter') {
          onSending(item.id)
        }
      }}
    >
      <AgentHubRequestCard
        item={item.item}
        presentation={{
          ...presentation,
          location: { ...presentation.location, host: item.hostLabel }
        }}
        controlRef={controlRef}
      />
    </fieldset>
  )
}
