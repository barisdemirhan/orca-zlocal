import { useLayoutEffect, useRef, useState } from 'react'
import { BellOff, CornerDownRight, Inbox, PictureInPicture2, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  AGENT_HUB_DOCK_ZOOM,
  type AgentHubDockPosition,
  type AgentHubDockSize
} from '../../../../shared/agent-hub-settings'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import { AgentHubArrangeMenu } from './AgentHubArrangeMenu'
import { AgentHubDockMenu } from './AgentHubDockMenu'
import {
  DOCK_BUTTON,
  DockButton,
  DockCounterGroup,
  DockLayer,
  NotchShape
} from './AgentHubDockParts'
import {
  agentHubDockDropPosition,
  agentHubDockPlacement,
  agentHubDockPopoverSide,
  isHorizontalAgentHubDock
} from './agent-hub-dock-geometry'
import type { AgentHubTab } from './agent-hub-keys'
import type { AgentHubCounts } from './agent-hub-lists'
import { useDockBarMotion } from './use-dock-bar-motion'
import { useViewportSize } from './use-viewport-size'

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
  onOpenTab,
  onNextWaiting,
  onToggleMirrors,
  onMove,
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
  onOpenTab: (tab: AgentHubTab) => void
  onNextWaiting: () => void
  onToggleMirrors: () => void
  onMove: (position: AgentHubDockPosition) => void
}): React.JSX.Element {
  const viewport = useViewportSize()
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
  const zoom = AGENT_HUB_DOCK_ZOOM[size]
  // The bar measures in its own (unzoomed) pixels; placement works in the window's.
  const lengthOf = (bar: { width: number; height: number }): number =>
    (isHorizontalAgentHubDock(position.edge) ? bar.width : bar.height) * zoom
  const placement = dragPoint
    ? { left: dragPoint.x, top: dragPoint.y, transform: 'translate(-50%, -50%)' }
    : agentHubDockPlacement(
        position,
        viewport,
        DOCK_CHROME,
        barSize && restSize ? { rest: lengthOf(restSize), current: lengthOf(barSize) } : null
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
    target instanceof Element && target.closest('button, [role="menu"]') !== null

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
      // Why the bar colour: the notch reads as part of the status bar or title bar it grows from.
      className="group/dock fixed z-[44] touch-none select-none [-webkit-app-region:no-drag] [--hub-notch:var(--bg-titlebar,var(--card))]"
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
          className="relative flex cursor-pointer items-center justify-start overflow-hidden data-[edge=left]:flex-col data-[edge=right]:flex-col text-foreground group-data-[dragging=true]/dock:cursor-grabbing data-[dragging=true]:rounded-[14px] data-[dragging=true]:border data-[dragging=true]:border-border data-[dragging=true]:bg-[var(--hub-notch)] data-[dragging=true]:shadow-floating data-[edge=bottom]:h-7 data-[edge=bottom]:rounded-t-[14px] data-[edge=bottom]:px-2.5 data-[edge=left]:w-7 data-[edge=left]:rounded-r-[14px] data-[edge=left]:py-2.5 data-[edge=right]:w-7 data-[edge=right]:rounded-l-[14px] data-[edge=right]:py-2.5 data-[edge=top]:h-7 data-[edge=top]:rounded-b-[14px] data-[edge=top]:px-2.5"
        >
          {/* Both faces open with the inbox and the counts at the same spot; unfolding only
              adds buttons after them, so whatever is under the pointer stays put. */}
          <DockLayer shown={expanded}>
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
              label={translate('agentHub.tab.all', 'All terminals')}
              side={side}
              className={DOCK_BUTTON}
              onClick={() => onOpenTab('all')}
            >
              <SquareTerminal className="size-3.5" />
            </DockButton>
            {/* Right-click lays the floating windows out between the sidebars. */}
            <AgentHubArrangeMenu onOpenChange={setMenuOpen}>
              <DockButton
                label={
                  mirrors.windows > 0
                    ? translate('agentHub.dock.dockMirrors', 'Send the mirrors to the hub')
                    : translate('agentHub.dock.restoreMirrors', 'Bring the mirrors back')
                }
                side={side}
                className={DOCK_BUTTON}
                disabled={mirrors.windows + mirrors.chips === 0}
                onClick={onToggleMirrors}
              >
                <PictureInPicture2 className="size-3.5" />
              </DockButton>
            </AgentHubArrangeMenu>
            <DockButton
              label={translate('agentHub.dock.nextWaiting', 'Jump to the next agent waiting')}
              side={side}
              className={DOCK_BUTTON}
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
          </DockLayer>
          <DockLayer shown={!expanded}>
            {/* Same size as the button it becomes, so the counts line up with the unfolded face. */}
            <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
              <Inbox aria-hidden className="size-3.5" />
            </span>
            <DockCounterGroup counts={counts} side={side} />
            {muted ? (
              <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
                <BellOff aria-hidden className="size-3" />
              </span>
            ) : null}
          </DockLayer>
        </div>
      </div>
    </div>
  )
}
