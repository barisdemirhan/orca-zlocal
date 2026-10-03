import { useLayoutEffect, useRef, useState } from 'react'
import { BellOff, Bot, CornerDownRight, Inbox, SquareTerminal } from 'lucide-react'
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
import { AgentHubDockMenu } from './AgentHubDockMenu'
import {
  DOCK_BUTTON,
  DOCK_COUNT_BUTTON,
  DockButton,
  DockCounter,
  DockCounters,
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
  onOpenTab,
  onNextWaiting,
  onMove,
  ...anchorProps
}: React.ComponentProps<'div'> & {
  position: AgentHubDockPosition
  size: AgentHubDockSize
  counts: AgentHubCounts
  muted: boolean
  onOpenTab: (tab: AgentHubTab) => void
  onNextWaiting: () => void
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
  const expanded = (hovered || menuOpen) && dragPoint === null
  const side = agentHubDockPopoverSide(position.edge)
  // Why measured: the hover bar is far longer than the notch, and must not run off an edge.
  const barSize = useDockBarMotion(barRef, notchRef, position.edge, expanded)
  const zoom = AGENT_HUB_DOCK_ZOOM[size]
  // The bar measures in its own (unzoomed) pixels; placement works in the window's.
  const extent = (isHorizontalAgentHubDock(position.edge) ? barSize?.width : barSize?.height) ?? 0
  const placement = dragPoint
    ? { left: dragPoint.x, top: dragPoint.y, transform: 'translate(-50%, -50%)' }
    : agentHubDockPlacement(position, viewport, DOCK_CHROME, extent * zoom)

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
          className="relative flex cursor-pointer items-center justify-center overflow-hidden text-foreground group-data-[dragging=true]/dock:cursor-grabbing data-[dragging=true]:rounded-[14px] data-[dragging=true]:border data-[dragging=true]:border-border data-[dragging=true]:bg-[var(--hub-notch)] data-[dragging=true]:shadow-floating data-[edge=bottom]:h-[26px] data-[edge=bottom]:rounded-t-[14px] data-[edge=bottom]:px-3.5 data-[edge=left]:w-[26px] data-[edge=left]:rounded-r-[14px] data-[edge=left]:py-3.5 data-[edge=right]:w-[26px] data-[edge=right]:rounded-l-[14px] data-[edge=right]:py-3.5 data-[edge=top]:h-[26px] data-[edge=top]:rounded-b-[14px] data-[edge=top]:px-3.5 data-[edge=bottom]:data-[expanded=true]:h-9 data-[edge=bottom]:data-[expanded=true]:px-1.5 data-[edge=left]:data-[expanded=true]:w-9 data-[edge=left]:data-[expanded=true]:py-1.5 data-[edge=right]:data-[expanded=true]:w-9 data-[edge=right]:data-[expanded=true]:py-1.5 data-[edge=top]:data-[expanded=true]:h-9 data-[edge=top]:data-[expanded=true]:px-1.5"
        >
          <DockLayer shown={expanded} spacing="tight">
            <DockButton
              label={translate('agentHub.tab.inbox', 'Inbox')}
              side={side}
              className={DOCK_BUTTON}
              onClick={() => onOpenTab('inbox')}
            >
              <Inbox className="size-3.5" />
            </DockButton>
            {/* The three counts read as one group, with no gaps between them. */}
            <span className="flex items-center group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col">
              <DockButton
                label={translate('agentHub.tab.running', 'Running')}
                side={side}
                className={DOCK_COUNT_BUTTON}
                onClick={() => onOpenTab('running')}
              >
                <DockCounter kind="work" value={counts.working} />
              </DockButton>
              <DockButton
                label={translate('agentHub.dock.waiting', 'Waiting on you')}
                side={side}
                className={DOCK_COUNT_BUTTON}
                onClick={() => onOpenTab('inbox')}
              >
                <DockCounter kind="ask" value={counts.needsYou} />
              </DockButton>
              <DockButton
                label={translate('agentHub.dock.finished', 'Finished')}
                side={side}
                className={DOCK_COUNT_BUTTON}
                onClick={() => onOpenTab('inbox')}
              >
                <DockCounter kind="done" value={counts.finished} />
              </DockButton>
            </span>
            <DockButton
              label={translate('agentHub.tab.all', 'All terminals')}
              side={side}
              className={DOCK_BUTTON}
              onClick={() => onOpenTab('all')}
            >
              <SquareTerminal className="size-3.5" />
            </DockButton>
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
          <DockLayer shown={!expanded} spacing="loose">
            <Bot aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <DockCounters counts={counts} />
            {muted ? <BellOff className="size-3 shrink-0 opacity-70" /> : null}
          </DockLayer>
        </div>
      </div>
    </div>
  )
}
