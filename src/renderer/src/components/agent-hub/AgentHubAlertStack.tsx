import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, PictureInPicture2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { HubAvatar, HubCrumb } from './AgentHubAtoms'
import type { AgentHubAlert } from './agent-hub-alerts'
import { agentHubMessageSummary } from './agent-hub-message-summary'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

const ALERT_VISIBLE_MS = 7000
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

/** One alert: who, what, where. Click opens it; it leaves on its own after a few seconds. */
function AlertCard({
  alert,
  location,
  onOpen,
  onJump,
  onPopout,
  onDismiss
}: {
  alert: AgentHubAlert
  location: AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  onJump: (alert: AgentHubAlert) => void
  onPopout: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
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
  return (
    <div
      role="status"
      data-agent-hub-alert={alert.kind}
      className="relative w-[320px] shrink-0 animate-in rounded-[14px] border border-foreground/[0.12] bg-popover px-3 py-2.5 text-popover-foreground shadow-floating duration-200 fade-in-0 zoom-in-95"
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
    >
      <button type="button" className="block w-full text-left" onClick={() => onOpen(alert)}>
        <span className="flex items-center gap-2.5 pr-20">
          <HubAvatar
            agentType={alert.thread.agentType}
            kind={alert.kind === 'done' ? 'done' : 'ask'}
          />
          <span className="min-w-0 flex-1 text-[12.5px]">
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
          <span className="mt-1.5 line-clamp-3 text-[12.5px] break-words text-foreground/85">
            {text}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        aria-label={translate('agentHub.hover.popout', 'Own window')}
        title={translate('agentHub.hover.popout', 'Own window')}
        onClick={() => onPopout(alert)}
        className="absolute top-2 right-14 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <PictureInPicture2 className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
        title={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
        onClick={() => onJump(alert)}
        className="absolute top-2 right-8 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <ArrowUpRight className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={translate('agentHub.alert.dismiss', 'Dismiss')}
        onClick={() => onDismiss(alert.id)}
        className="absolute top-2 right-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
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
  onDismiss
}: {
  alerts: readonly AgentHubAlert[]
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
  locationOf: (alert: AgentHubAlert) => AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  /** Straight to the terminal in its workspace, past the mirror or card a click opens. */
  onJump: (alert: AgentHubAlert) => void
  /** The terminal in a floating mirror, whatever a click on the alert opens. */
  onPopout: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
}): React.JSX.Element {
  const stackRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (stackRef.current && anchorRef.current) {
      placeBesideAnchor(stackRef.current, anchorRef.current, side)
    }
  })

  // The anchor can grow under the stack (the tray fanning out of its pile).
  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      return
    }
    const observer = new ResizeObserver(() => {
      if (stackRef.current) {
        placeBesideAnchor(stackRef.current, anchor, side)
      }
    })
    observer.observe(anchor)
    return () => observer.disconnect()
  }, [anchorRef, side])

  // Newest nearest the anchor: last when the stack grows upward, first when it hangs below.
  const ordered = side === 'bottom' ? alerts.toReversed() : alerts
  return createPortal(
    <div
      ref={stackRef}
      data-agent-hub-alert-stack
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      className="fixed z-[47] flex max-h-[min(70vh,560px)] flex-col gap-2 overflow-y-auto p-0.5 scrollbar-sleek"
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
        />
      ))}
    </div>,
    document.body
  )
}
