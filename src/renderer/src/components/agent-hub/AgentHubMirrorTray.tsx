import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsDownUp } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubAlertSide } from './AgentHubAlertStack'
import { AgentHubMirrorChip } from './AgentHubMirrorChip'
import { AgentHubBotFamilyChip } from './AgentHubBotFamilyChip'
import { AgentHubBotFamilyProbe } from './AgentHubBotFamilyProbe'
import { groupAgentHubBotFamilies } from './agent-hub-bot-family'
import type { AgentHubBotIdentity } from './agent-hub-bot-identity'
import type { AgentHubAlert, AgentHubRequestAlert, AgentHubThreadAlert } from './agent-hub-alerts'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubMirrorChip as ChipState } from './agent-hub-mirror-store'
import { AGENT_HUB_TRAY_VISIBLE, foldAgentHubTray } from './agent-hub-mirror-tray'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { useAnchorBinding } from './use-anchor-binding'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'

export type AgentHubTrayItem = {
  key: string
  chip: ChipState
  thread: AgentPaneThread | null
  kind: AgentHubIndicatorKind
  location: AgentHubLocation
  alert: AgentHubAlert | null
}

const GAP = 10
const MARGIN = 8
// Leaving the tray for a moment (to reach a chip's alert) must not snap it back into a pile.
const PILE_DELAY_MS = 260
// Passing over the pile on the way to the composer must not fan it over the composer.
const FAN_DELAY_MS = 220
// A chip is 40px tall and 6px from the next; piled, each one behind peeks out by this much.
const PILE_PEEK = 6
const PILE_STEP = 46 - PILE_PEEK
const PILE_DEPTH = 2

/** Where a chip sits in the pile: tucked behind the one before it, smaller the deeper it is. */
function pileStyle(index: number, piled: boolean, side: AgentHubAlertSide): React.CSSProperties {
  const depth = Math.min(index, PILE_DEPTH)
  const buried = index > PILE_DEPTH
  const pull = piled && index > 0 ? -(buried ? 46 : PILE_STEP) : 0
  return {
    zIndex: 20 - index,
    // The tray above a bottom dock stacks upward, so the pull is toward the chip below.
    ...(side === 'top' ? { marginBottom: pull } : { marginTop: pull }),
    transform: piled ? `scale(${1 - depth * 0.05})` : 'none',
    opacity: piled && buried ? 0 : 1
  }
}

/**
 * Puts the tray beside the hub, lined up with the hub's start (left, or top on a side edge):
 * the dock unfolds from that start, so the tray stays put while it does.
 */
function placeTray(tray: HTMLElement, hub: HTMLElement, side: AgentHubAlertSide): void {
  const rect = hub.getBoundingClientRect()
  const { innerWidth, innerHeight } = window
  const width = tray.offsetWidth
  const height = tray.offsetHeight
  const clampX = (x: number): number => Math.min(innerWidth - width - MARGIN, Math.max(MARGIN, x))
  const clampY = (y: number): number => Math.min(innerHeight - height - MARGIN, Math.max(MARGIN, y))
  const position =
    side === 'top'
      ? { left: clampX(rect.left), top: clampY(rect.top - height - GAP) }
      : side === 'bottom'
        ? { left: clampX(rect.left), top: clampY(rect.bottom + GAP) }
        : side === 'left'
          ? { left: clampX(rect.left - width - GAP), top: clampY(rect.top) }
          : { left: clampX(rect.right + GAP), top: clampY(rect.top) }
  tray.style.left = `${position.left}px`
  tray.style.top = `${position.top}px`
}

/**
 * Keeps the tray beside the hub. Why a first child: its layout effect runs before the chips'
 * own (children before parents, earlier siblings first), so their alerts measure a placed tray.
 */
function TrayPlacement({
  trayRef,
  anchorRef,
  side
}: {
  trayRef: React.RefObject<HTMLDivElement | null>
  anchorRef: React.RefObject<HTMLElement | null>
  side: AgentHubAlertSide
}): null {
  useLayoutEffect(() => {
    if (trayRef.current && anchorRef.current) {
      placeTray(trayRef.current, anchorRef.current, side)
    }
  })
  // The hub moves (dragged to an edge, unfolding on hover) and the window resizes.
  useAnchorBinding(anchorRef, side, (anchor) => {
    const place = (): void => {
      if (trayRef.current) {
        placeTray(trayRef.current, anchor, side)
      }
    }
    const resizes = new ResizeObserver(place)
    resizes.observe(anchor)
    // The tray itself grows and shrinks as it fans out of its pile.
    if (trayRef.current) {
      resizes.observe(trayRef.current)
    }
    const moves = new MutationObserver(place)
    moves.observe(anchor, { attributes: true, attributeFilter: ['style', 'data-edge'] })
    window.addEventListener('resize', place)
    return () => {
      resizes.disconnect()
      moves.disconnect()
      window.removeEventListener('resize', place)
    }
  })
  return null
}

/**
 * Minimized mirrors, parked beside the hub as a pile with the most urgent on top. Resting on
 * the pile (not the hub) fans it out: four at most until the "+N" opens the rest.
 */
export function AgentHubMirrorTray({
  items,
  trayRef,
  anchorRef,
  side,
  alertSide,
  hidden,
  alertsHidden = false,
  peekMs,
  onRestore,
  onReveal,
  onClose,
  onOpenAlert,
  locationOfAlert,
  onDismissAlert,
  requestPresentationOf
}: {
  /** Already ordered, most urgent first. */
  items: readonly AgentHubTrayItem[]
  trayRef: React.RefObject<HTMLDivElement | null>
  /** The hub: the dock, or its status-bar trigger. */
  anchorRef: React.RefObject<HTMLElement | null>
  /** Which way from the hub the tray opens. */
  side: AgentHubAlertSide
  /** Where a chip's alert opens: away from the hub, toward the roomier side. */
  alertSide: AgentHubAlertSide
  /** Out of sight while the hub's own panel is open over the same spot. */
  hidden: boolean
  alertsHidden?: boolean
  /** How long the pile fans out when a parked mirror asks or finishes; 0 never. */
  peekMs: number
  onRestore: (key: string) => void
  onReveal: (item: AgentHubTrayItem, alert?: AgentHubAlert) => void
  locationOfAlert?: (alert: AgentHubThreadAlert | AgentHubRequestAlert) => AgentHubLocation
  onClose: (key: string) => void
  onOpenAlert: (key: string, alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
  requestPresentationOf?: (alert: AgentHubRequestAlert) => AgentHubRequestPresentation
}): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const [pointed, setPointed] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [identities, setIdentities] = useState<ReadonlyMap<string, AgentHubBotIdentity>>(
    () => new Map()
  )
  const onIdentity = useCallback((key: string, identity: AgentHubBotIdentity | null): void => {
    setIdentities((current) => {
      if (!identity && !current.has(key)) {
        return current
      }
      const next = new Map(current)
      if (identity) {
        next.set(key, identity)
      } else {
        next.delete(key)
      }
      return next
    })
  }, [])
  const pileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = (timerRef: typeof pileTimerRef): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const fan = (): void => {
    clearTimer(pileTimerRef)
    clearTimer(fanTimerRef)
    setPointed(true)
  }
  const point = (): void => {
    clearTimer(pileTimerRef)
    if (!pointed && !fanTimerRef.current) {
      fanTimerRef.current = setTimeout(fan, FAN_DELAY_MS)
    }
  }
  const unpoint = (): void => {
    clearTimer(fanTimerRef)
    pileTimerRef.current = setTimeout(() => setPointed(false), PILE_DELAY_MS)
  }
  useEffect(
    () => () => {
      clearTimer(pileTimerRef)
      clearTimer(fanTimerRef)
    },
    []
  )
  // News from a parked mirror (it asks or finishes) shows the whole pile for a moment.
  const news = items
    .filter((item) => item.kind === 'ask' || item.kind === 'done')
    .map((item) => `${item.key}:${item.kind}`)
    .join('|')
  const seenNewsRef = useRef(new Set<string>())
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const current = news ? news.split('|') : []
    const fresh = current.some((entry) => !seenNewsRef.current.has(entry))
    seenNewsRef.current = new Set(current)
    if (!fresh || peekMs <= 0) {
      return
    }
    // Why no cleanup here: news that merely leaves must not cut a running peek short.
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current)
    }
    setPeeking(true)
    peekTimerRef.current = setTimeout(() => setPeeking(false), peekMs)
  }, [news, peekMs])
  useEffect(
    () => () => {
      if (peekTimerRef.current) {
        clearTimeout(peekTimerRef.current)
      }
    },
    []
  )
  const fanned = pointed || peeking
  const entries = groupAgentHubBotFamilies(items, (key) => identities.get(key))
  // With nothing left behind "+N", the next overflow starts folded again.
  if (expanded && entries.length <= AGENT_HUB_TRAY_VISIBLE) {
    setExpanded(false)
  }
  const { shown, folded } = foldAgentHubTray(entries, expanded)
  if (items.length === 0) {
    return null
  }
  const piled = !fanned && shown.length > 1
  // Why a portal: the hub's tray stays above the mirrors (44) and floating workspace (45).
  return createPortal(
    <div
      ref={trayRef}
      data-agent-hub-mirror-tray
      data-side={side}
      data-hidden={hidden}
      data-piled={piled}
      data-expanded={expanded && !piled}
      inert={hidden}
      data-resting={!fanned}
      onPointerEnter={point}
      onPointerLeave={unpoint}
      onFocus={fan}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Nearest the hub first: a tray above the bottom dock stacks upward.
      // Why faded as one layer: what is behind stays readable until the tray is pointed at, and
      // piled chips do not show through each other the way see-through cards would.
      className="pointer-events-auto fixed z-[47] flex max-h-[calc(100vh-96px)] flex-col items-start gap-1.5 p-0.5 transition-opacity duration-200 scrollbar-sleek data-[resting=true]:opacity-80 data-[hidden=true]:pointer-events-none data-[hidden=true]:invisible data-[expanded=true]:overflow-y-auto data-[side=top]:flex-col-reverse"
    >
      <TrayPlacement trayRef={trayRef} anchorRef={anchorRef} side={side} />
      {items.map((item) => (
        <AgentHubBotFamilyProbe key={item.key} chip={item.chip} onIdentity={onIdentity} />
      ))}
      {shown.map((entry, index) => (
        <div
          key={entry.key}
          style={pileStyle(index, piled, side)}
          className="relative shrink-0 transition-[margin,transform,opacity] duration-300 ease-out"
        >
          {entry.type === 'family' ? (
            <AgentHubBotFamilyChip
              bot={entry.bot}
              members={entry.members}
              alertSide={alertSide}
              alertsHidden={alertsHidden}
              locationOfAlert={locationOfAlert}
              requestPresentationOf={requestPresentationOf}
              onRestore={onRestore}
              onReveal={onReveal}
              onClose={onClose}
              onOpenAlert={onOpenAlert}
              onDismissAlert={onDismissAlert}
            />
          ) : (
            <AgentHubMirrorChip
              chip={entry.item.chip}
              thread={entry.item.thread}
              kind={entry.item.kind}
              location={entry.item.location}
              alert={alertsHidden ? null : entry.item.alert}
              alertSide={alertSide}
              locationOfAlert={locationOfAlert}
              requestPresentationOf={requestPresentationOf}
              onRestore={() => onRestore(entry.item.key)}
              onReveal={(alert) => onReveal(entry.item, alert)}
              onClose={() => onClose(entry.item.key)}
              onOpenAlert={(alert) => onOpenAlert(entry.item.key, alert)}
              onDismissAlert={onDismissAlert}
            />
          )}
        </div>
      ))}
      {!piled && (folded > 0 || expanded) ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-foreground/20 bg-popover px-2.5 font-mono text-[11px] text-muted-foreground shadow-floating hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronsDownUp aria-hidden className="size-3" />
              {translate('agentHub.mirror.trayLess', 'Show fewer')}
            </>
          ) : (
            translate('agentHub.mirror.trayMore', '+{{value0}}', { value0: folded })
          )}
        </button>
      ) : null}
    </div>,
    document.body
  )
}
