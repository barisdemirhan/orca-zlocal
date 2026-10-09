import { Button } from '@/components/ui/button'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, PictureInPicture2, X } from 'lucide-react'
import { isEditableTarget } from '@/lib/editable-target'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { HubAvatar } from './AgentHubStateMarks'
import { HubCrumb, HubKeys } from './AgentHubInlineLabels'
import { useAgentHubQuickAnswer } from './use-agent-hub-quick-answer'
import type { AgentHubAlert } from './agent-hub-alerts'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { useAnchorBinding } from './use-anchor-binding'
import { useAgentHubWorktreeCurrent } from './use-agent-hub-worktree-current'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

const ALERT_VISIBLE_MS = 7000
// Long enough to read "answered", short enough that the bubble is gone before the next one.
const ANSWERED_VISIBLE_MS = 1000
const QUICK_OPTION_LIMIT = 4
const GAP = 10

export type AgentHubAlertSide = 'top' | 'bottom' | 'left' | 'right'

function alertHeadline(alert: AgentHubAlert): string {
  switch (alert.kind) {
    case 'ask':
      return translate('agentHub.alert.asking', 'is asking')
    case 'approval':
      return translate('agentHub.alert.needsApproval', 'needs approval')
    case 'done':
      return translate('agentHub.alert.finished', 'finished')
  }
}

function alertText(alert: AgentHubAlert): string {
  const entry = alert.thread.currentAgentEntry ?? alert.thread.paneEntry
  if (alert.kind !== 'done') {
    const card = parseInteractivePrompt(entry?.interactivePrompt, entry?.toolName)
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

/** The keys are free for an alert only while no field or terminal would take them. */
export function agentHubAlertKeysAvailable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true
  }
  return (
    !isEditableTarget(target) && target.closest('.xterm, [role="dialog"], [role="menu"]') === null
  )
}

/** Places a floating element beside its anchor (the hub, the tray or a chip), kept on screen. */
function placeBesideAnchor(
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

export type AgentHubAlertCardControl = { choose: (index: number) => boolean }

/** One alert: who, what, where. Click opens it; it leaves on its own after a few seconds. */
function AlertCard({
  alert,
  location,
  onOpen,
  onJump,
  onPopout,
  onDismiss,
  onControl
}: {
  alert: AgentHubAlert
  location: AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  onJump: (alert: AgentHubAlert) => void
  onPopout: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
  /** Hands the stack this card's answer control, for the number keys. */
  onControl?: (id: string, control: AgentHubAlertCardControl | null) => void
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
  const quick = useAgentHubQuickAnswer(alert.thread)
  const options = alert.kind === 'done' ? [] : quick.options.slice(0, QUICK_OPTION_LIMIT)
  const choose = (index: number): boolean => {
    if (!quick.choose(index)) {
      return false
    }
    // Answered: the bubble shows what went out, then leaves.
    stopTimer()
    timerRef.current = setTimeout(() => onDismiss(alert.id), ANSWERED_VISIBLE_MS)
    return true
  }
  const chooseRef = useRef(choose)
  useLayoutEffect(() => {
    chooseRef.current = choose
  })
  useEffect(() => {
    if (!onControl || options.length === 0) {
      return undefined
    }
    onControl(alert.id, { choose: (index) => chooseRef.current(index) })
    return () => onControl(alert.id, null)
  }, [onControl, alert.id, options.length])
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
        {options.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1" data-agent-hub-alert-options>
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                disabled={quick.chosen !== null || !quick.canAnswer}
                data-chosen={quick.chosen === index}
                data-recommended={option.recommended === true}
                aria-label={translate('agentHub.quick.answerWith', 'Answer: {{value0}}', {
                  value0: typeof option.label === 'string' ? option.label : String(index + 1)
                })}
                onClick={() => choose(index)}
                className="flex max-w-full items-center gap-1.5 rounded-md border border-foreground/[0.1] bg-foreground/[0.03] px-2 py-1 text-xs text-foreground hover:bg-foreground/[0.07] disabled:cursor-default disabled:opacity-60 data-[chosen=true]:border-status-success/60 data-[chosen=true]:text-status-success data-[chosen=true]:opacity-100 data-[recommended=true]:border-ring/60"
              >
                {quick.chosen === index ? (
                  <Check aria-hidden className="size-3" />
                ) : (
                  <HubKeys keys={[String(index + 1)]} />
                )}
                <span className="truncate">{option.label}</span>
              </button>
            ))}
            {quick.chosen === null && quick.options.length > options.length ? (
              <span className="self-center text-xs text-muted-foreground">
                {translate('agentHub.quick.more', '↵ for all {{value0}}', {
                  value0: quick.options.length
                })}
              </span>
            ) : null}
          </div>
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
  answerKeys = false
}: {
  alerts: readonly AgentHubAlert[]
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
  /** 1–9 answers the newest question or approval and ↵ opens it, while no field has the keys. */
  answerKeys?: boolean
  locationOf: (alert: AgentHubAlert) => AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  /** Straight to the terminal in its workspace, past the mirror or card a click opens. */
  onJump: (alert: AgentHubAlert) => void
  /** The terminal in a floating mirror, whatever a click on the alert opens. */
  onPopout: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
}): React.JSX.Element {
  const stackRef = useRef<HTMLDivElement>(null)
  const controls = useRef(new Map<string, AgentHubAlertCardControl>())
  const onControl = useCallback((id: string, control: AgentHubAlertCardControl | null): void => {
    if (control) {
      controls.current.set(id, control)
    } else {
      controls.current.delete(id)
    }
  }, [])
  // Why newest: a key answers the question that just arrived, the one the eye is on.
  const front = alerts.findLast((alert) => alert.kind !== 'done') ?? null
  const onOpenRef = useRef(onOpen)
  useLayoutEffect(() => {
    onOpenRef.current = onOpen
  })
  useEffect(() => {
    if (!answerKeys || !front) {
      return undefined
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing ||
        !agentHubAlertKeysAvailable(event.target)
      ) {
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        onOpenRef.current(front)
        return
      }
      const index = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1
      if (index >= 0 && controls.current.get(front.id)?.choose(index)) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [answerKeys, front])

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
      {ordered.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          location={locationOf(alert)}
          onOpen={onOpen}
          onJump={onJump}
          onPopout={onPopout}
          onDismiss={onDismiss}
          onControl={answerKeys ? onControl : undefined}
        />
      ))}
    </div>,
    document.body
  )
}
