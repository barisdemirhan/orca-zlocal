import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store'
import { agentHubCanResolveGate } from './agent-hub-gate-capability'
import { splitRecommendedOptionLabel } from '../native-chat/native-chat-option-label'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { HubOptionList, HubReplyField } from './AgentHubAnswerBody'
import { AgentHubPeekChips } from './AgentHubPeekChips'
import { HubAvatar } from './AgentHubStateMarks'
import { AgentHubRequestSource } from './AgentHubRequestSource'
import type { AgentHubCardControl } from './AgentHubAttentionCard'
import { answerAgentHubRequest } from './agent-hub-request-answer'
import {
  agentHubConsentAction,
  type AgentHubRequestPresentation
} from './agent-hub-request-presentation'
import {
  agentHubRequestKey,
  useAgentHubRequests,
  type AgentHubInboxRequest
} from './agent-hub-requests-store'
import { AGENT_HUB_CARD_KEY_GUARD_MS } from './use-agent-hub-quick-answer'
import { useAgentHubOrbName } from './use-agent-hub-orb-identity'

export function AgentHubRequestCard({
  item,
  presentation,
  controlRef,
  compact = false,
  onOpen,
  onDismiss,
  dismissLabel
}: {
  item: AgentHubInboxRequest
  presentation: AgentHubRequestPresentation
  controlRef?: Ref<AgentHubCardControl>
  compact?: boolean
  onOpen?: () => void
  onDismiss?: () => void
  dismissLabel?: string
}): React.JSX.Element {
  const { host, request } = item
  const state = useAgentHubRequests().get(host)?.answerStates.get(request.requestId)
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set())
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = Date.now()
  }, [])
  const canResolveGate = useAppStore((app) => agentHubCanResolveGate(app, host))
  const busy =
    (state !== undefined && state.phase !== 'error') || (request.kind === 'gate' && !canResolveGate)
  const orbName = useAgentHubOrbName()
  const agent = request.caller.kind === 'orb' ? orbName : (request.caller.agentType ?? 'agent')
  const send = (result: Parameters<typeof answerAgentHubRequest>[2]): void => {
    void answerAgentHubRequest(host, request.requestId, result)
  }
  const choose = (index: number): boolean => {
    if ((request.kind !== 'ask' && request.kind !== 'gate') || busy || !request.options[index]) {
      return false
    }
    if (request.multi && !compact) {
      setSelected((current) => {
        const next = new Set(current)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
    } else {
      send({
        kind: 'ask',
        answer: request.options[index],
        index: index + 1,
        ...(request.multi ? { indices: [index + 1] } : {})
      })
    }
    return true
  }
  useImperativeHandle(controlRef, () => ({
    chooseOption: (index) =>
      Date.now() - mountedAt.current >= AGENT_HUB_CARD_KEY_GUARD_MS && choose(index)
  }))
  const status =
    state?.phase === 'sending'
      ? translate('agentHub.requests.sending', 'Sending…')
      : state?.phase === 'answered-elsewhere'
        ? (state.message ?? translate('agentHub.requests.answeredElsewhere', 'Answered elsewhere'))
        : state?.message
  const headline =
    request.kind === 'ask' || request.kind === 'gate'
      ? translate('agentHub.requests.asks', '@{{agent}} asks', { agent })
      : request.kind === 'consent'
        ? translate('agentHub.requests.wantsTo', '@{{agent}} wants to {{action}}', {
            agent,
            action: agentHubConsentAction(request.operation, presentation.targetTitle)
          })
        : `@${agent}`
  const header = (
    <>
      <div className="flex items-start gap-2.5 pr-6">
        <HubAvatar
          agentType={request.caller.agentType ?? null}
          kind={
            request.kind === 'notify'
              ? request.level === 'done'
                ? 'done'
                : request.level === 'info'
                  ? 'idle'
                  : 'ask'
              : 'ask'
          }
        />
        <div className="min-w-0 flex-1">
          <div
            data-tone={request.kind === 'notify' ? request.level : 'needs-you'}
            className="text-[13px] font-semibold break-words text-agent-question-text data-[tone=done]:text-status-success data-[tone=info]:text-foreground"
          >
            {headline}
          </div>
          {request.kind === 'gate' ? (
            <Badge variant="secondary">
              {translate('agentHub.requests.decisionGate', 'Decision gate')}
            </Badge>
          ) : null}
          {request.kind === 'gate' ? (
            <div className="truncate text-xs text-muted-foreground">
              {request.runTitle} · {request.taskTitle}
            </div>
          ) : null}
          <AgentHubRequestSource presentation={presentation} />
        </div>
      </div>
      {compact && (request.kind === 'ask' || request.kind === 'gate') ? (
        <div className="mt-3 mb-2 text-sm leading-snug font-semibold">{request.question}</div>
      ) : null}
      {compact && request.kind === 'notify' ? (
        <div className="mt-2 text-sm break-words">{request.text}</div>
      ) : null}
    </>
  )
  const content = (
    <>
      {compact && onOpen && (request.kind !== 'notify' || request.level === 'needs-you') ? (
        <button type="button" className="block w-full text-left" onClick={onOpen}>
          {header}
        </button>
      ) : (
        header
      )}
      {request.kind === 'ask' || request.kind === 'gate' ? (
        <>
          {!compact ? (
            <div className="mt-3 mb-2 text-sm leading-snug font-semibold">{request.question}</div>
          ) : null}
          <HubOptionList
            density={compact ? 'chip' : 'card'}
            options={request.options.slice(0, compact ? 4 : undefined).map((label, index) => ({
              id: String(index),
              label: request.kind === 'gate' ? splitRecommendedOptionLabel(label).label : label,
              recommended:
                request.kind === 'ask'
                  ? request.recommended === index + 1
                  : splitRecommendedOptionLabel(label).recommended
            }))}
            chosen={null}
            selected={request.multi && !compact ? selected : undefined}
            label={request.question}
            disabled={busy}
            onChoose={choose}
          />
          {request.multi && !compact ? (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={busy || selected.size === 0}
              onClick={() => {
                const indices = [...selected].sort((a, b) => a - b).map((index) => index + 1)
                send({
                  kind: 'ask',
                  answer: indices.map((index) => request.options[index - 1]).join(', '),
                  index: null,
                  indices
                })
              }}
            >
              {translate('agentHub.card.send', 'Send')}
            </Button>
          ) : null}
          {compact ? (
            request.options.length > 4 ? (
              <Button type="button" variant="ghost" size="xs" onClick={onOpen}>
                {translate('agentHub.quick.more', '↵ for all {{value0}}', {
                  value0: request.options.length
                })}
              </Button>
            ) : null
          ) : (
            <HubReplyField
              placeholder={translate('agentHub.card.replyTo', 'Reply to @{{value0}}…', {
                value0: agent
              })}
              disabled={busy}
              onSend={(answer) => send({ kind: 'ask', answer, index: null })}
            />
          )}
        </>
      ) : request.kind === 'consent' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['once', 'session', 'deny'] as const).map((decision) => (
            <Button
              key={decision}
              type="button"
              variant={decision === 'once' ? 'default' : 'secondary'}
              size="xs"
              disabled={busy}
              onClick={() => send({ kind: 'consent', decision })}
            >
              {decision === 'once'
                ? translate('agentHub.requests.allowOnce', 'Allow once')
                : decision === 'session'
                  ? translate('agentHub.requests.allowSession', 'Allow for this session')
                  : translate('agentHub.requests.deny', 'Deny')}
            </Button>
          ))}
        </div>
      ) : (
        <>
          {!compact ? <div className="mt-2 text-sm break-words">{request.text}</div> : null}
          <AgentHubPeekChips
            text={request.text}
            links={request.links}
            worktree={presentation.target?.worktree}
          />
        </>
      )}
      {request.kind === 'gate' && !canResolveGate ? (
        <div role="status" className="mt-2 text-xs text-muted-foreground">
          {translate(
            'agentHub.requests.gateUpdateRequired',
            'Update this host to answer decision gates.'
          )}
        </div>
      ) : null}
      {status ? (
        <div role="status" className="mt-2 text-xs text-muted-foreground">
          {status}
        </div>
      ) : null}
    </>
  )
  return (
    <section
      aria-label={headline}
      data-agent-hub-request-card={agentHubRequestKey(host, request.requestId)}
      data-agent-hub-alert={
        compact
          ? request.kind === 'consent'
            ? 'approval'
            : request.kind === 'notify'
              ? request.level === 'needs-you'
                ? 'ask'
                : request.level
              : 'ask'
          : undefined
      }
      className={
        compact
          ? 'relative w-80 shrink-0 animate-in rounded-xl border border-foreground/[0.12] bg-popover px-3 py-2.5 text-popover-foreground shadow-floating duration-200 fade-in-0 zoom-in-95'
          : 'relative animate-in rounded-xl border border-foreground/[0.08] bg-foreground/[0.035] px-3.5 pt-3.5 pb-2.5 duration-200 fade-in-0 slide-in-from-right-1'
      }
    >
      {content}
      {request.kind === 'notify' || onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-2 right-2"
          aria-label={dismissLabel ?? translate('agentHub.alert.dismiss', 'Dismiss')}
          disabled={busy}
          onClick={() =>
            // A needs-you bubble only steps aside; its Inbox card is what closes the notice.
            request.kind === 'notify' && !(compact && request.level === 'needs-you' && onDismiss)
              ? send({ kind: 'ack' })
              : onDismiss?.()
          }
        >
          <X />
        </Button>
      ) : null}
    </section>
  )
}
