import { useLayoutEffect, useRef, useState } from 'react'
import {
  BellOff,
  Bot,
  CornerDownRight,
  Frame,
  Inbox,
  PictureInPicture2,
  SquareTerminal
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  AGENT_HUB_DOCK_ZOOM,
  type AgentHubDockPosition,
  type AgentHubDockSize
} from '../../../../shared/agent-hub-settings'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import { AgentHubDockArrangeButton } from './AgentHubDockArrangeButton'
import { AgentHubDockMenu } from './AgentHubDockMenu'
import {
  DOCK_BUTTON,
  DOCK_COUNT_BUTTON,
  DockButton,
  DockCounterGroup,
  DockExtras,
  NotchShape
} from './AgentHubDockParts'
import {
  agentHubDockDropPosition,
  agentHubDockPlacement,
  agentHubDockPopoverSide,
  agentHubDockMeasuredExtent
} from './agent-hub-dock-geometry'
import type { AgentHubTab } from './agent-hub-keys'
import {
  useAgentHubTerminalCounts,
  type AgentHubTerminalCountInput
} from './use-agent-hub-terminal-counts'
import type { AgentHubCounts } from './agent-hub-lists'
import { agentHubMirrorsToggleAction } from './agent-hub-mirror-tray'
import { useDockBarMotion } from './use-dock-bar-motion'
import { useViewportSize } from './use-viewport-size'
import { AgentHubOrbButton } from './AgentHubOrbButton'
import type { AgentHubOrbState } from './agent-hub-orb-state'

// Leaving the dock for a moment (to reach the popover) must not snap it shut.
const COLLAPSE_DELAY_MS = 220
const DRAG_THRESHOLD_PX = 5
const DOCK_CHROME = {
  statusBarHeight: STATUS_BAR_RESERVE_HEIGHT,
  titleBarHeight: WORKSPACE_TOP_CHROME_HEIGHT
}

/**
 * The hub's default home: a notch on the status bar or a window edge. Hover unfolds it into a
 * bar of shortcuts; drag it to another edge. Anchor props (ref, data) from the popover pass through.
 */
export function AgentHubDock({
  position,
  size,
  counts,
  muted,
  pinned,
  mirrors,
  canvas,
  flushTop,
  terminals,
  onOpenTab,
  onNextWaiting,
  onToggleMirrors,
  onMove,
  orb,
  ...anchorProps
}: React.ComponentProps<'div'> & {
  position: AgentHubDockPosition
  size: AgentHubDockSize
  counts: AgentHubCounts
  muted: boolean
  /** Keep it unfolded (the hub's panel is open from it). */
  pinned: boolean
  /** Open mirror windows and the ones parked beside the hub. */
  mirrors: { windows: number; chips: number }
  /** The canvas switch, while the canvas setting is on. */
  canvas: { open: boolean; onToggle: () => void } | null
  /** The canvas covers the title bar: a top dock hangs from the window's own edge instead. */
  flushTop: boolean
  /** What the agents count (always on show) and the All terminals count (unfolded) read. */
  terminals: AgentHubTerminalCountInput
  onOpenTab: (tab: AgentHubTab) => void
  onNextWaiting: () => void
  onToggleMirrors: () => void
  onMove: (position: AgentHubDockPosition) => void
  orb?: {
    state: AgentHubOrbState
    onOpen: (alternate?: boolean) => void
    disabled: boolean
    recall?: boolean
  } | null
}): React.JSX.Element {
  const viewport = useViewportSize()
  const terminalCounts = useAgentHubTerminalCounts(terminals)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const pointerRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null)
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const notchRef = useRef<SVGSVGElement>(null)
  // Held open with the hub's panel, so the panel anchored to it does not shift.
  const expanded = (hovered || menuOpen || pinned) && dragPoint === null
  const side = agentHubDockPopoverSide(position.edge)
  // Why measured: the hover bar is far longer than the notch, and must not run off an edge.
  const { size: barSize, rest: restSize } = useDockBarMotion(
    barRef,
    notchRef,
    position.edge,
    expanded
  )
  const hasMirrors = mirrors.windows + mirrors.chips > 0
  const canvasLabel = canvas?.open
    ? translate('agentHub.canvas.leave', 'Leave the canvas')
    : translate('agentHub.dock.openCanvas', 'Open the canvas')
  const mirrorsButton = (
    <DockButton
      label={
        agentHubMirrorsToggleAction(mirrors) === 'restore'
          ? translate('agentHub.dock.restoreMirrors', 'Bring the mirrors back')
          : translate('agentHub.dock.dockMirrors', 'Send the mirrors to the hub')
      }
      side={side}
      className={DOCK_BUTTON}
      actionId="agentHub.dockMirrors"
      disabled={!hasMirrors}
      onClick={onToggleMirrors}
    >
      <PictureInPicture2 className="size-3.5" />
    </DockButton>
  )
  const zoom = AGENT_HUB_DOCK_ZOOM[size]
  // The bar measures in its own (unzoomed) pixels; placement works in the window's.
  const placement = dragPoint
    ? { left: dragPoint.x, top: dragPoint.y, transform: 'translate(-50%, -50%)' }
    : agentHubDockPlacement(
        position,
        viewport,
        flushTop ? { ...DOCK_CHROME, titleBarHeight: 0 } : DOCK_CHROME,
        agentHubDockMeasuredExtent(position.edge, zoom, restSize, barSize)
      )

  useLayoutEffect(
    () => () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
      }
    },
    []
  )

  const onTarget = (target: EventTarget): boolean =>
    target instanceof Element &&
    target.closest('button, [data-agent-hub-dock-button], [role="menu"]') !== null

  return (
    <div
      {...anchorProps}
      // Why: the dock portals out but React bubbles its right-click to the status bar's menu.
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      data-agent-hub-dock
      data-edge={position.edge}
      data-expanded={expanded}
      data-dragging={dragPoint !== null}
      style={placement}
      // Why z-[47]: hub controls stay above mirrors (44), floating workspace (45), and Peek (46).
      // Why the bar colour: the notch reads as part of the status bar or title bar it grows from.
      className="group/dock fixed z-[47] touch-none select-none [-webkit-app-region:no-drag] [--hub-notch:var(--bg-titlebar,var(--card))]"
      onPointerEnter={() => {
        if (collapseTimerRef.current) {
          clearTimeout(collapseTimerRef.current)
        }
        setHovered(true)
      }}
      onPointerLeave={() => {
        collapseTimerRef.current = setTimeout(() => setHovered(false), COLLAPSE_DELAY_MS)
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || onTarget(event.target)) {
          return
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerRef.current = { x: event.clientX, y: event.clientY, dragging: false }
      }}
      onPointerMove={(event) => {
        const pointer = pointerRef.current
        if (!pointer) {
          return
        }
        const moved = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y)
        if (pointer.dragging || moved > DRAG_THRESHOLD_PX) {
          pointer.dragging = true
          setDragPoint({ x: event.clientX, y: event.clientY })
        }
      }}
      onPointerUp={(event) => {
        const pointer = pointerRef.current
        pointerRef.current = null
        if (!pointer) {
          return
        }
        event.currentTarget.releasePointerCapture(event.pointerId)
        if (pointer.dragging) {
          setDragPoint(null)
          onMove(agentHubDockDropPosition({ x: event.clientX, y: event.clientY }, viewport))
        } else {
          onOpenTab('inbox')
        }
      }}
    >
      {/* Why zoom: one switch scales the notch, its icons and its outline together. */}
      <div className="relative" style={{ zoom }}>
        <NotchShape notchRef={notchRef} />
        <div
          ref={barRef}
          data-edge={position.edge}
          data-expanded={expanded}
          data-dragging={dragPoint !== null}
          className="relative flex cursor-pointer items-center justify-start overflow-hidden data-[edge=left]:flex-col data-[edge=right]:flex-col text-foreground group-data-[dragging=true]/dock:cursor-grabbing data-[dragging=true]:rounded-xl data-[dragging=true]:border data-[dragging=true]:border-border data-[dragging=true]:bg-[var(--hub-notch)] data-[dragging=true]:shadow-floating data-[edge=bottom]:h-7 data-[edge=bottom]:rounded-t-xl data-[edge=bottom]:px-2.5 data-[edge=left]:w-7 data-[edge=left]:rounded-r-xl data-[edge=left]:py-2.5 data-[edge=right]:w-7 data-[edge=right]:rounded-l-xl data-[edge=right]:py-2.5 data-[edge=top]:h-7 data-[edge=top]:rounded-b-xl data-[edge=top]:px-2.5"
        >
          {orb ? (
            <>
              <AgentHubOrbButton {...orb} side={side} />
              <span
                aria-hidden
                className="mx-1 h-3.5 shrink-0 border-l border-border group-data-[edge=left]/dock:mx-0 group-data-[edge=left]/dock:my-1 group-data-[edge=left]/dock:h-0 group-data-[edge=left]/dock:w-3.5 group-data-[edge=left]/dock:border-t group-data-[edge=left]/dock:border-l-0 group-data-[edge=right]/dock:mx-0 group-data-[edge=right]/dock:my-1 group-data-[edge=right]/dock:h-0 group-data-[edge=right]/dock:w-3.5 group-data-[edge=right]/dock:border-t group-data-[edge=right]/dock:border-l-0"
              />
            </>
          ) : null}
          {/* One face. The inbox, the counts and (with mirrors open or parked) the mirrors button
              are drawn once and hold still; unfolding only lets the bar grow over the buttons
              after them, so whatever is under the pointer stays put. */}
          <div
            // Folded, the notch is one target: a click opens the inbox and a drag moves it.
            inert={!expanded}
            className="relative flex shrink-0 items-center gap-0.5 group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col"
          >
            <DockButton
              label={translate('agentHub.tab.inbox', 'Inbox')}
              side={side}
              className={DOCK_BUTTON}
              onClick={() => onOpenTab('inbox')}
            >
              <Inbox className="size-3.5" />
            </DockButton>
            <DockCounterGroup counts={counts} side={side} onOpenTab={onOpenTab} />
            <DockButton
              label={translate('agentHub.tab.agents', 'Agents')}
              side={side}
              className={DOCK_COUNT_BUTTON}
              onClick={() => onOpenTab('agents')}
            >
              <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col">
                <Bot aria-hidden className="size-3.5" />
                {terminalCounts.agents}
              </span>
            </DockButton>
            {hasMirrors ? mirrorsButton : null}
            {canvas ? (
              <DockButton
                label={canvasLabel}
                actionId="agentHub.toggleCanvas"
                side={side}
                className={DOCK_BUTTON}
                pressed={canvas.open}
                onClick={canvas.onToggle}
              >
                <Frame className="size-3.5" />
              </DockButton>
            ) : null}
            <AgentHubDockArrangeButton
              open={mirrors.windows > 0}
              side={side}
              onOpenChange={setMenuOpen}
            />
            {muted ? (
              <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
                <BellOff aria-hidden className="size-3" />
              </span>
            ) : null}
            <DockExtras shown={expanded}>
              {/* With no mirror to act on, the (disabled) button shows only unfolded. */}
              {hasMirrors ? null : mirrorsButton}
              <DockButton
                label={translate('agentHub.tab.all', 'All terminals')}
                side={side}
                className={DOCK_COUNT_BUTTON}
                onClick={() => onOpenTab('all')}
              >
                <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col">
                  <SquareTerminal className="size-3.5" />
                  <span className="min-w-[2ch] text-center">
                    {expanded ? terminalCounts.all : null}
                  </span>
                </span>
              </DockButton>
              <DockButton
                label={translate('agentHub.dock.nextWaiting', 'Jump to the next agent waiting')}
                side={side}
                className={DOCK_BUTTON}
                actionId="agentHub.nextWaiting"
                disabled={counts.needsYou === 0}
                onClick={onNextWaiting}
              >
                <CornerDownRight className="size-3.5" />
              </DockButton>
              <AgentHubDockMenu
                edge={position.edge}
                size={size}
                muted={muted}
                onOpenChange={setMenuOpen}
                buttonClassName={DOCK_BUTTON}
              />
            </DockExtras>
          </div>
        </div>
      </div>
    </div>
  )
}
