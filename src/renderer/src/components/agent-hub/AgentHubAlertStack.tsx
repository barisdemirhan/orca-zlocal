import { Button } from '@/components/ui/button'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, PictureInPicture2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/threads/activity-thread-presentation'
import { parseInteractivePrompt } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { sayNativeChatApprovalTranslated } from '../native-chat/prompts/native-chat-interactive-prompt'
import { HubAvatar } from './AgentHubStateMarks'
import { HubCrumb } from './AgentHubInlineLabels'
import { AgentHubAlertQuickOptions } from './AgentHubAlertQuickOptions'
import { AGENT_HUB_ANSWERED_VISIBLE_MS } from './use-agent-hub-quick-answer'
import type {
  AgentHubAlert,
  AgentHubThreadAlert,
  AgentHubRequestAlert as RequestAlert
} from './agent-hub-alerts'
import { AgentHubRequestAlert } from './AgentHubRequestAlert'
import { AgentHubBotAlertCard } from './AgentHubBotAlertCard'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { useAnchorBinding } from './use-anchor-binding'
import { useAgentHubWorktreeCurrent } from './use-agent-hub-worktree-current'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'

const ALERT_VISIBLE_MS = 7000
const GAP = 10

export type AgentHubAlertSide = 'top' | 'bottom' | 'left' | 'right'

function alertHeadline(alert: AgentHubThreadAlert): string {
  switch (alert.kind) {
    case 'ask':
      return translate('agentHub.alert.asking', 'is asking')
    case 'approval':
      return translate('agentHub.alert.needsApproval', 'needs approval')
    case 'done':
      return translate('agentHub.alert.finished', 'finished')
  }
}

function alertText(alert: AgentHubThreadAlert): string {
  const entry = alert.thread.currentAgentEntry ?? alert.thread.paneEntry
  if (alert.kind !== 'done') {
    const card = parseInteractivePrompt(
      entry?.interactivePrompt,
      entry?.toolName,
      undefined,
      sayNativeChatApprovalTranslated
    )
    if (card?.kind === 'question') {
      return card.prompt.questions[0]?.question ?? ''
    }
    if (card?.kind === 'approval') {
      return card.approval.detail ?? card.approval.title
    }
  }
  const message = entry?.lastAssistantMessageIsToolOutput
    ? null
    : entry?.lastAssistantMessage?.trim()
  return message ? agentHubMessageSummary(message) : activityThreadRowCopy(alert.thread).statusLine
}

/** Places a floating element beside its anchor (the hub, the tray or a chip), kept on screen. */
export function placeBesideAnchor(
  bubble: HTMLElement,
  anchor: HTMLElement,
  side: AgentHubAlertSide
): void {
  const rect = anchor.getBoundingClientRect()
  const { innerWidth, innerHeight } = window
  const width = bubble.offsetWidth
  const height = bubble.offsetHeight
  if (side === 'top' || side === 'bottom') {
    const left = Math.min(
      innerWidth - width - 8,
      Math.max(8, rect.left + rect.width / 2 - width / 2)
    )
    bubble.style.left = `${left}px`
    bubble.style.top =
      side === 'top'
        ? `${Math.max(8, rect.top - height - GAP)}px`
        : `${Math.min(innerHeight - height - 8, rect.bottom + GAP)}px`
    return
  }
  const top = Math.min(
    innerHeight - height - 8,
    Math.max(8, rect.top + rect.height / 2 - height / 2)
  )
  bubble.style.top = `${top}px`
  bubble.style.left =
    side === 'left' ? `${Math.max(8, rect.left - width - GAP)}px` : `${rect.right + GAP}px`
}

/** One alert: who, what, where. Click opens it; it leaves on its own after a few seconds. */
function AlertCard({
  alert,
  location,
  onOpen,
  onJump,
  onPopout,
  onDismiss,
  answerKeys
}: {
  alert: AgentHubThreadAlert
  location: AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  onJump: (alert: AgentHubAlert) => void
  onPopout: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
  /** The front bubble answers to 1–9 and opens with ↵. */
  answerKeys: boolean
}): React.JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimer = (): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => onDismiss(alert.id), ALERT_VISIBLE_MS)
  }
  const stopTimer = (): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  useEffect(() => {
    startTimer()
    return stopTimer
    // Why only the id: a new alert restarts the countdown; re-renders must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert.id])

  const text = alertText(alert)
  const current = useAgentHubWorktreeCurrent(alert.thread.worktree.id)
  // Answered: the bubble shows what went out, then leaves.
  const onAnswered = (): void => {
    stopTimer()
    timerRef.current = setTimeout(() => onDismiss(alert.id), AGENT_HUB_ANSWERED_VISIBLE_MS)
  }
  return (
    <div
      role="status"
      data-agent-hub-alert={alert.kind}
      className="w-80 shrink-0 animate-in rounded-xl border border-foreground/[0.12] bg-popover text-popover-foreground shadow-floating duration-200 fade-in-0 zoom-in-95"
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
    >
      {/* Why an inner layer: the card's enter animation owns the root's opacity. */}
      <div
        data-current={current}
        title={
          current
            ? translate('agentHub.row.currentWorkspace', 'In the workspace you have open')
            : undefined
        }
        className="relative px-3 py-2.5 transition-opacity data-[current=true]:opacity-55 data-[current=true]:hover:opacity-100"
      >
        <button type="button" className="block w-full text-left" onClick={() => onOpen(alert)}>
          <span className="flex items-center gap-2.5 pr-20">
            <HubAvatar
              agentType={alert.thread.agentType}
              kind={alert.kind === 'done' ? 'done' : 'ask'}
            />
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="block truncate">
                <span className="font-semibold">@{alert.thread.agentType}</span>{' '}
                <span
                  data-kind={alert.kind}
                  className="text-agent-question-text data-[kind=done]:text-status-success"
                >
                  {alertHeadline(alert)}
                </span>
              </span>
              <HubCrumb location={location} />
            </span>
          </span>
          {text ? (
            <span className="mt-1.5 line-clamp-3 text-[13px] break-words text-foreground/85">
              {text}
            </span>
          ) : null}
        </button>
        {alert.kind !== 'done' ? (
          <AgentHubAlertQuickOptions
            alert={alert}
            answerKeys={answerKeys}
            onOpen={() => onOpen(alert)}
            onAnswered={onAnswered}
          />
        ) : null}
        <AgentHubActionTooltip
          label={translate('agentHub.hover.popout', 'Own window')}
          actionId="agentHub.popOut"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.hover.popout', 'Own window')}
            onClick={() => onPopout(alert)}
            className="absolute top-2 right-14"
          >
            <PictureInPicture2 className="size-3.5" />
          </Button>
        </AgentHubActionTooltip>
        <AgentHubActionTooltip
          label={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate(
              'agentHub.mirror.jumpHint',
              'Jump to this terminal in its workspace'
            )}
            onClick={() => onJump(alert)}
            className="absolute top-2 right-8"
          >
            <ArrowUpRight className="size-3.5" />
          </Button>
        </AgentHubActionTooltip>
        <AgentHubActionTooltip label={translate('agentHub.alert.dismiss', 'Dismiss')}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('agentHub.alert.dismiss', 'Dismiss')}
            onClick={() => onDismiss(alert.id)}
            className="absolute top-2 right-2"
          >
            <X className="size-3.5" />
          </Button>
        </AgentHubActionTooltip>
      </div>
    </div>
  )
}

/**
 * The alerts beside their anchor (the hub or a mirror chip), newest nearest to it. The queue
 * keeps one per pane and a handful in all; past what fits, the stack scrolls.
 */
export function AgentHubAlertStack({
  alerts,
  anchorRef,
  side,
  locationOf,
  onOpen,
  onJump,
  onPopout,
  onDismiss,
  answerKeys = false,
  requestPresentationOf
}: {
  alerts: readonly AgentHubAlert[]
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
  /** 1–9 answers the newest question or approval and ↵ opens it, while no field has the keys. */
  answerKeys?: boolean
  locationOf: (alert: AgentHubThreadAlert | RequestAlert) => AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  /** Straight to the terminal in its workspace, past the mirror or card a click opens. */
  onJump: (alert: AgentHubAlert) => void
  /** The terminal in a floating mirror, whatever a click on the alert opens. */
  onPopout: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
  requestPresentationOf?: (alert: RequestAlert) => AgentHubRequestPresentation
}): React.JSX.Element {
  const stackRef = useRef<HTMLDivElement>(null)
  // Why newest: a key answers the question that just arrived, the one the eye is on.
  const front =
    alerts.findLast((alert) => alert.kind === 'ask' || alert.kind === 'approval') ?? null
  useLayoutEffect(() => {
    if (stackRef.current && anchorRef.current) {
      placeBesideAnchor(stackRef.current, anchorRef.current, side)
    }
  })

  // The anchor can grow under the stack (the tray fanning out of its pile).
  useAnchorBinding(anchorRef, side, (anchor) => {
    const observer = new ResizeObserver(() => {
      if (stackRef.current) {
        placeBesideAnchor(stackRef.current, anchor, side)
      }
    })
    observer.observe(anchor)
    return () => observer.disconnect()
  })

  // Newest nearest the anchor: last when the stack grows upward, first when it hangs below.
  const ordered = side === 'bottom' ? alerts.toReversed() : alerts
  return createPortal(
    <div
      ref={stackRef}
      data-agent-hub-alert-stack
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      className="fixed z-[48] flex max-h-[min(70vh,560px)] flex-col gap-2 overflow-y-auto p-0.5 scrollbar-sleek"
    >
      {ordered.map((alert) =>
        alert.bot ? (
          <AgentHubBotAlertCard key={alert.id} alert={alert} onDismiss={onDismiss} />
        ) : alert.request ? (
          <AgentHubRequestAlert
            key={alert.id}
            alert={alert}
            presentation={
              requestPresentationOf?.(alert) ?? {
                title: alert.request.caller.title ?? alert.request.caller.terminalHandle,
                targetTitle: alert.request.target.terminalHandle,
                target: null,
                location: locationOf(alert)
              }
            }
            onOpen={() => onOpen(alert)}
            onDismiss={onDismiss}
            answerKeys={answerKeys && alert.id === front?.id}
          />
        ) : (
          <AlertCard
            key={alert.id}
            alert={alert}
            location={locationOf(alert)}
            onOpen={onOpen}
            onJump={onJump}
            onPopout={onPopout}
            onDismiss={onDismiss}
            answerKeys={answerKeys && alert.id === front?.id}
          />
        )
      )}
    </div>,
    document.body
  )
}
