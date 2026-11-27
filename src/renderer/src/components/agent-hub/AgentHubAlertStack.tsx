import { Button } from '@/components/ui/button'
import { AgentHubActionTooltip } from './AgentHubShortcut'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { ArrowUpRight, PictureInPicture2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
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
import { agentHubAlertText } from './agent-hub-alert-text'
import { AgentHubBotAlertCard } from './AgentHubBotAlertCard'
import { agentHubBotAlertBubbles } from './agent-hub-bot-alert-groups'
import { AgentHubBotChipRow, type AgentHubBotChipEntry } from './AgentHubBotPendingChips'
import { pushAgentHubAlerts } from './agent-hub-alert-queue'
import { unparkAgentHubBots, useAgentHubParkedBots } from './agent-hub-bot-parked-store'
import { useAgentHubBotNeedsList } from './agent-hub-bot-needs-store'
import { openBotAlerts } from './use-agent-hub-bot-alerts'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { useAnchorBinding } from './use-anchor-binding'
import { useAgentHubWorktreeCurrent } from './use-agent-hub-worktree-current'
import { AgentHubAlertStackFrame } from './AgentHubAlertStackFrame'

const ALERT_VISIBLE_MS = 7000
const GAP = 10
const MAX_BOT_BUBBLES = 5

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

  const text = agentHubAlertText(alert)
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
  requestPresentationOf,
  onOpenInbox
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
  /** "Open in Inbox" on a bot's "N updates" bubble. */
  onOpenInbox?: () => void
}): React.JSX.Element | null {
  const stackRef = useRef<HTMLDivElement>(null)
  // Why the newest timestamp: a dismissal lowers it never, so only a new alert restarts countdowns.
  const arrival = alerts.reduce((latest, alert) => Math.max(latest, alert.bot?.at ?? 0), 0)
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

  const needsList = useAgentHubBotNeedsList()
  const parked = useAgentHubParkedBots()
  const allBubbles = agentHubBotAlertBubbles(alerts)
  // Past five bubbles the older ones wait in the chip.
  const botBubbles = allBubbles.slice(-MAX_BOT_BUBBLES)
  const folded = new Set(
    allBubbles.slice(0, -MAX_BOT_BUBBLES).map((entry) => entry.lead.bot.botKey)
  )
  const shownBots = new Set(botBubbles.map((entry) => entry.lead.bot.botKey))
  const chipEntries = needsList.flatMap((needs): AgentHubBotChipEntry[] =>
    needs.count > 0 &&
    !needs.orbOnly &&
    !shownBots.has(needs.botKey) &&
    (parked.has(needs.botKey) || folded.has(needs.botKey))
      ? [{ bot: needs.bot, botKey: needs.botKey, count: needs.count }]
      : []
  )
  const reopenBot = (entry: AgentHubBotChipEntry): void => {
    const needs = needsList.find((candidate) => candidate.botKey === entry.botKey)
    unparkAgentHubBots([entry.botKey])
    if (needs) {
      pushAgentHubAlerts(openBotAlerts(needs, Date.now()))
    }
  }
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  const others = alerts.filter((alert): alert is AgentHubThreadAlert | RequestAlert => !alert.bot)
  const ordered =
    side === 'bottom'
      ? [...botBubbles.toReversed(), ...others.toReversed()]
      : [...others, ...botBubbles]
  const chips = (
    <AgentHubBotChipRow
      key="bot-chips"
      entries={chipEntries}
      onOpenBot={reopenBot}
      onOpenInbox={() => onOpenInbox?.()}
    />
  )
  if (ordered.length === 0 && chipEntries.length === 0) {
    return null
  }
  return (
    <AgentHubAlertStackFrame stackRef={stackRef}>
      {(held) => (
        <>
          {side === 'bottom' ? chips : null}
          {ordered.map((entry) =>
            'lead' in entry ? (
              <AgentHubBotAlertCard
                key={entry.lead.bot.botKey}
                lead={entry.lead}
                updates={entry.updates}
                ids={entry.ids}
                onDismiss={onDismiss}
                onOpenInbox={onOpenInbox}
                reduceMotion={reduceMotion}
                answerKeys={answerKeys && entry.lead.id === front?.id}
                onOpenAlert={onOpen}
                presentationOf={(request) =>
                  requestPresentationOf?.(request) ?? {
                    title: request.request.caller.title ?? request.request.caller.terminalHandle,
                    targetTitle: request.request.target.terminalHandle,
                    target: null,
                    location: locationOf(request)
                  }
                }
                held={held}
                arrival={arrival}
              />
            ) : entry.request ? (
              <AgentHubRequestAlert
                key={entry.id}
                alert={entry}
                presentation={
                  requestPresentationOf?.(entry) ?? {
                    title: entry.request.caller.title ?? entry.request.caller.terminalHandle,
                    targetTitle: entry.request.target.terminalHandle,
                    target: null,
                    location: locationOf(entry)
                  }
                }
                onOpen={() => onOpen(entry)}
                onDismiss={onDismiss}
                answerKeys={answerKeys && entry.id === front?.id}
              />
            ) : (
              <AlertCard
                key={entry.id}
                alert={entry}
                location={locationOf(entry)}
                onOpen={onOpen}
                onJump={onJump}
                onPopout={onPopout}
                onDismiss={onDismiss}
                answerKeys={answerKeys && entry.id === front?.id}
              />
            )
          )}
          {side === 'bottom' ? null : chips}
        </>
      )}
    </AgentHubAlertStackFrame>
  )
}
