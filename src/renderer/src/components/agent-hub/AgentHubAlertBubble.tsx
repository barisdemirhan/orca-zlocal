import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import { parseInteractivePrompt } from '../native-chat/native-chat-interactive-prompt'
import { HubAvatar, HubCrumb } from './AgentHubAtoms'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubLocation } from './agent-hub-pane-target'

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
  return entry?.lastAssistantMessageIsToolOutput
    ? activityThreadRowCopy(alert.thread).statusLine
    : entry?.lastAssistantMessage?.trim() || activityThreadRowCopy(alert.thread).statusLine
}

/** Place the bubble beside its anchor (the hub trigger or a mirror chip) on the given side. */
function placeBubble(bubble: HTMLElement, anchor: HTMLElement, side: AgentHubAlertSide): void {
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

/** Toast-like alert beside the hub; click opens the agent's card, it fades after a few seconds. */
export function AgentHubAlertBubble({
  alert,
  pending,
  anchorRef,
  side,
  location,
  onOpen,
  onDismiss
}: {
  alert: AgentHubAlert
  pending: number
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
  location: AgentHubLocation
  onOpen: (alert: AgentHubAlert) => void
  onDismiss: (id: string) => void
}): React.JSX.Element {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (bubbleRef.current && anchorRef.current) {
      placeBubble(bubbleRef.current, anchorRef.current, side)
    }
  })

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
  return createPortal(
    <div
      ref={bubbleRef}
      role="status"
      data-agent-hub-alert={alert.kind}
      className="fixed z-[47] w-[320px] animate-in rounded-[14px] border border-foreground/[0.12] bg-popover px-3 py-2.5 text-popover-foreground shadow-floating fade-in-0 zoom-in-95"
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
    >
      <button type="button" className="block w-full text-left" onClick={() => onOpen(alert)}>
        <span className="flex items-center gap-2.5 pr-6">
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
          <span className="mt-1.5 line-clamp-2 block text-[12.5px] break-words text-foreground/85">
            {text}
          </span>
        ) : null}
        {pending > 1 ? (
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {translate('agentHub.alert.more', '+{{value0}} more in the hub', {
              value0: pending - 1
            })}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        aria-label={translate('agentHub.alert.dismiss', 'Dismiss')}
        onClick={() => onDismiss(alert.id)}
        className="absolute top-2 right-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>,
    document.body
  )
}
