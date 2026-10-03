import { useEffect, useLayoutEffect, useState } from 'react'
import { ChevronsDownUp } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubAlertSide } from './AgentHubAlertStack'
import { AgentHubMirrorChip } from './AgentHubMirrorChip'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubMirrorChip as ChipState } from './agent-hub-mirror-store'
import { AGENT_HUB_TRAY_VISIBLE, foldAgentHubTray } from './agent-hub-mirror-tray'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

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
  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) {
      return
    }
    const place = (): void => {
      if (trayRef.current) {
        placeTray(trayRef.current, anchor, side)
      }
    }
    const resizes = new ResizeObserver(place)
    resizes.observe(anchor)
    const moves = new MutationObserver(place)
    moves.observe(anchor, { attributes: true, attributeFilter: ['style', 'data-edge'] })
    window.addEventListener('resize', place)
    return () => {
      resizes.disconnect()
      moves.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, side, trayRef])
  return null
}

/**
 * Minimized mirrors, parked beside the hub: the most urgent nearest it, four at most until the
 * "+N" opens the rest.
 */
export function AgentHubMirrorTray({
  items,
  trayRef,
  anchorRef,
  side,
  alertSide,
  hidden,
  onRestore,
  onReveal,
  onClose,
  onOpenAlert,
  onDismissAlert
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
  onRestore: (key: string) => void
  onReveal: (item: AgentHubTrayItem) => void
  onClose: (key: string) => void
  onOpenAlert: (key: string, alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
}): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const { shown, folded } = foldAgentHubTray(items, expanded)
  if (items.length === 0) {
    return null
  }
  return (
    <div
      ref={trayRef}
      data-agent-hub-mirror-tray
      data-side={side}
      data-hidden={hidden}
      data-expanded={expanded}
      inert={hidden}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Nearest the hub first: a tray above the bottom dock stacks upward.
      className="pointer-events-auto fixed flex max-h-[calc(100vh-96px)] flex-col items-start gap-1.5 p-0.5 transition-opacity duration-150 scrollbar-sleek data-[hidden=true]:pointer-events-none data-[hidden=true]:opacity-0 data-[expanded=true]:overflow-y-auto data-[side=top]:flex-col-reverse"
    >
      <TrayPlacement trayRef={trayRef} anchorRef={anchorRef} side={side} />
      {shown.map((item) => (
        <AgentHubMirrorChip
          key={item.key}
          chip={item.chip}
          thread={item.thread}
          kind={item.kind}
          location={item.location}
          alert={item.alert}
          alertSide={alertSide}
          onRestore={() => onRestore(item.key)}
          onReveal={() => onReveal(item)}
          onClose={() => onClose(item.key)}
          onOpenAlert={(alert) => onOpenAlert(item.key, alert)}
          onDismissAlert={onDismissAlert}
        />
      ))}
      {folded > 0 || (expanded && items.length > AGENT_HUB_TRAY_VISIBLE) ? (
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
    </div>
  )
}
