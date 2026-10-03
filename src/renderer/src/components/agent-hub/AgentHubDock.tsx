import { useRef, useState, useSyncExternalStore } from 'react'
import { BellOff, CornerDownRight, Inbox, SquareTerminal } from 'lucide-react'
import { AgentWorkingSpinner } from '@/components/AgentWorkingSpinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { AgentHubDockPosition } from '../../../../shared/agent-hub-settings'
import { STATUS_BAR_RESERVE_HEIGHT } from '../sidebar/workspace-chrome-metrics'
import { AgentHubDockMenu } from './AgentHubDockMenu'
import {
  agentHubDockDropPosition,
  agentHubDockPlacement,
  agentHubDockPopoverSide
} from './agent-hub-dock-geometry'
import type { AgentHubTab } from './agent-hub-keys'
import type { AgentHubCounts } from './agent-hub-lists'

// Leaving the dock for a moment (to reach the popover) must not snap it shut.
const COLLAPSE_DELAY_MS = 220
const DRAG_THRESHOLD_PX = 5

const DOCK_BUTTON =
  'relative grid size-8 shrink-0 place-items-center rounded-full text-background/80 hover:bg-background/15 hover:text-background disabled:pointer-events-none disabled:opacity-40 dark:text-foreground/80 dark:hover:bg-foreground/15 dark:hover:text-foreground'
const DOCK_COUNT_BUTTON =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] text-background/80 hover:bg-background/15 hover:text-background dark:text-foreground/80 dark:hover:bg-foreground/15 dark:hover:text-foreground'

function subscribeViewport(listener: () => void): () => void {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}
const viewportKey = (): string => `${window.innerWidth}x${window.innerHeight}`

function useViewportSize(): { width: number; height: number } {
  const key = useSyncExternalStore(subscribeViewport, viewportKey)
  const [width, height] = key.split('x').map(Number)
  return { width: width ?? 0, height: height ?? 0 }
}

function DockDots({ counts }: { counts: AgentHubCounts }): React.JSX.Element {
  const idle = counts.working === 0 && counts.needsYou === 0 && counts.finished === 0
  return (
    <>
      {counts.working > 0 ? <AgentWorkingSpinner className="size-3 shrink-0" /> : null}
      {Array.from({ length: Math.min(counts.needsYou, 3) }, (_, index) => (
        <span
          key={index}
          className="size-2.5 shrink-0 animate-pulse rounded-full bg-agent-question"
        />
      ))}
      {counts.finished > 0 ? (
        <span className="size-2.5 shrink-0 rounded-full bg-status-success" />
      ) : null}
      {idle ? (
        <span className="size-2.5 shrink-0 rounded-full bg-background/35 dark:bg-foreground/30" />
      ) : null}
    </>
  )
}

function DockButton({
  label,
  side,
  className,
  disabled,
  onClick,
  children
}: {
  label: string
  side: 'top' | 'left' | 'right'
  className: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={className}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Concave fillets where the notch meets the status bar or the window edge. */
function NotchCorners({ edge }: { edge: AgentHubDockPosition['edge'] }): React.JSX.Element {
  const fill = (at: string): React.CSSProperties => ({
    background: `radial-gradient(circle at ${at}, transparent 9.5px, var(--hub-notch) 10px)`
  })
  if (edge === 'bottom') {
    return (
      <>
        <span aria-hidden className="absolute bottom-0 -left-2.5 size-2.5" style={fill('0 0')} />
        <span
          aria-hidden
          className="absolute -right-2.5 bottom-0 size-2.5"
          style={fill('100% 0')}
        />
      </>
    )
  }
  return edge === 'right' ? (
    <>
      <span aria-hidden className="absolute -top-2.5 right-0 size-2.5" style={fill('0 0')} />
      <span aria-hidden className="absolute right-0 -bottom-2.5 size-2.5" style={fill('0 100%')} />
    </>
  ) : (
    <>
      <span aria-hidden className="absolute -top-2.5 left-0 size-2.5" style={fill('100% 0')} />
      <span
        aria-hidden
        className="absolute -bottom-2.5 left-0 size-2.5"
        style={fill('100% 100%')}
      />
    </>
  )
}

/**
 * The hub's default home: a notch on the status bar or a window edge. Hover unfolds it into a
 * bar of shortcuts; drag it to another edge. Anchor props (ref, data) from the popover pass through.
 */
export function AgentHubDock({
  position,
  counts,
  muted,
  onOpenTab,
  onNextWaiting,
  onMove,
  ...anchorProps
}: React.ComponentProps<'div'> & {
  position: AgentHubDockPosition
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
  const expanded = (hovered || menuOpen) && dragPoint === null
  const side = agentHubDockPopoverSide(position.edge)
  const placement = dragPoint
    ? { left: dragPoint.x, top: dragPoint.y, transform: 'translate(-50%, -50%)' }
    : agentHubDockPlacement(position, viewport, STATUS_BAR_RESERVE_HEIGHT)

  const onTarget = (target: EventTarget): boolean =>
    target instanceof Element && target.closest('button, [role="menu"]') !== null

  return (
    <div
      {...anchorProps}
      data-agent-hub-dock
      data-edge={position.edge}
      data-expanded={expanded}
      data-dragging={dragPoint !== null}
      style={placement}
      className="group/dock fixed z-[44] touch-none select-none [--hub-notch:var(--foreground)] dark:[--hub-notch:var(--background)]"
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
      <div
        data-edge={position.edge}
        data-expanded={expanded}
        data-dragging={dragPoint !== null}
        className="relative flex cursor-pointer items-center justify-center gap-2 bg-[var(--hub-notch)] text-background shadow-floating group-data-[dragging=true]/dock:cursor-grabbing data-[dragging=true]:rounded-[14px] data-[edge=bottom]:h-[26px] data-[edge=bottom]:flex-row data-[edge=bottom]:rounded-t-[14px] data-[edge=bottom]:px-3.5 data-[edge=left]:w-[26px] data-[edge=left]:flex-col data-[edge=left]:rounded-r-[14px] data-[edge=left]:py-3.5 data-[edge=right]:w-[26px] data-[edge=right]:flex-col data-[edge=right]:rounded-l-[14px] data-[edge=right]:py-3.5 dark:text-foreground data-[edge=bottom]:data-[expanded=true]:h-11 data-[edge=bottom]:data-[expanded=true]:gap-1 data-[edge=bottom]:data-[expanded=true]:px-2 data-[edge=left]:data-[expanded=true]:w-11 data-[edge=left]:data-[expanded=true]:gap-1 data-[edge=left]:data-[expanded=true]:py-2 data-[edge=right]:data-[expanded=true]:w-11 data-[edge=right]:data-[expanded=true]:gap-1 data-[edge=right]:data-[expanded=true]:py-2"
      >
        {dragPoint === null ? <NotchCorners edge={position.edge} /> : null}
        {expanded ? (
          <>
            <DockButton
              label={translate('agentHub.tab.inbox', 'Inbox')}
              side={side}
              className={DOCK_BUTTON}
              onClick={() => onOpenTab('inbox')}
            >
              <Inbox className="size-4" />
              {counts.needsYou > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-agent-question px-1 text-[10px] leading-none font-semibold text-background">
                  {counts.needsYou}
                </span>
              ) : null}
            </DockButton>
            <span className="flex items-center gap-1.5 px-1 group-data-[edge=left]/dock:flex-col group-data-[edge=right]/dock:flex-col">
              <DockDots counts={counts} />
            </span>
            <DockButton
              label={translate('agentHub.tab.running', 'Running')}
              side={side}
              className={DOCK_COUNT_BUTTON}
              onClick={() => onOpenTab('running')}
            >
              <AgentWorkingSpinner className="size-3" />
              {counts.working}
            </DockButton>
            <DockButton
              label={translate('agentHub.tab.all', 'All terminals')}
              side={side}
              className={DOCK_BUTTON}
              onClick={() => onOpenTab('all')}
            >
              <SquareTerminal className="size-4" />
            </DockButton>
            <DockButton
              label={translate('agentHub.dock.nextWaiting', 'Jump to the next agent waiting')}
              side={side}
              className={DOCK_BUTTON}
              disabled={counts.needsYou === 0}
              onClick={onNextWaiting}
            >
              <CornerDownRight className="size-4" />
            </DockButton>
            <AgentHubDockMenu
              edge={position.edge}
              muted={muted}
              onOpenChange={setMenuOpen}
              buttonClassName={DOCK_BUTTON}
            />
          </>
        ) : (
          <>
            <DockDots counts={counts} />
            {muted ? <BellOff className="size-3 shrink-0 opacity-70" /> : null}
          </>
        )}
      </div>
    </div>
  )
}
