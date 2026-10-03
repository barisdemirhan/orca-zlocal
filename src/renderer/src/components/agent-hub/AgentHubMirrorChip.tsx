import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubStateIndicator } from './AgentHubAtoms'
import { AgentHubAlertStack } from './AgentHubAlertStack'
import type { AgentHubAlert } from './agent-hub-alerts'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubMirrorChip as ChipState } from './agent-hub-mirror-store'
import type { AgentHubLocation } from './agent-hub-pane-target'
import { useViewportSize } from './use-viewport-size'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

const DRAG_THRESHOLD_PX = 4
// Keeps a chip reachable after a window resize; the status bar owns the bottom strip.
const EDGE_GAP = 8
const BOTTOM_RESERVE = 32
// The chip's max width, so even a long title keeps its close button on screen.
const CHIP_MAX_WIDTH = 240
const CHIP_HEIGHT = 32
// Near the top, the alert hangs below the chip instead of off screen.
const BUBBLE_FLIP_Y = 160

type Point = { x: number; y: number }

function clampChip(position: Point, viewport: { width: number; height: number }): Point {
  return {
    x: Math.min(Math.max(EDGE_GAP, position.x), viewport.width - CHIP_MAX_WIDTH - EDGE_GAP),
    y: Math.min(Math.max(EDGE_GAP, position.y), viewport.height - CHIP_HEIGHT - BOTTOM_RESERVE)
  }
}

/** A minimized mirror: drag it anywhere, click to restore, and it speaks up when its agent does. */
export function AgentHubMirrorChip({
  chip,
  thread,
  location,
  alert,
  stackIndex,
  onRestore,
  onClose,
  onMove,
  onOpenAlert,
  onDismissAlert
}: {
  chip: ChipState
  thread: AgentPaneThread | null
  location: AgentHubLocation
  alert: AgentHubAlert | null
  stackIndex: number
  onRestore: () => void
  onClose: () => void
  onMove: (position: { x: number; y: number }) => void
  onOpenAlert: (alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
}): React.JSX.Element {
  const chipRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ x: number; y: number; dragging: boolean; origin: Point } | null>(null)
  const [dragPosition, setDragPosition] = useState<Point | null>(null)
  const viewport = useViewportSize()
  // Why re-clamped on every render: a window resize must not strand the chip off screen.
  const position = clampChip(dragPosition ?? chip, viewport)
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'
  const agent = agentTypeToIconAgent(chip.target.agentType)

  return (
    <>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <div
            ref={chipRef}
            role="button"
            tabIndex={-1}
            aria-label={translate('agentHub.mirror.restore', 'Restore {{value0}}', {
              value0: chip.target.title
            })}
            data-agent-hub-mirror-chip
            {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
            data-kind={kind}
            style={{ left: position.x, top: position.y, zIndex: stackIndex }}
            className="group/chip pointer-events-auto fixed flex h-8 max-w-[240px] animate-in cursor-pointer touch-none items-center gap-2 rounded-full border border-foreground/25 bg-popover pr-1 pl-2.5 text-popover-foreground shadow-floating duration-200 select-none fade-in-0 zoom-in-90 data-[kind=ask]:border-agent-question/60 motion-reduce:animate-none"
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                (event.target instanceof Element && event.target.closest('button'))
              ) {
                return
              }
              event.currentTarget.setPointerCapture(event.pointerId)
              pointerRef.current = {
                x: event.clientX,
                y: event.clientY,
                dragging: false,
                // Why the shown spot: a resize may have re-clamped it away from the stored one.
                origin: position
              }
            }}
            onPointerMove={(event) => {
              const pointer = pointerRef.current
              if (!pointer) {
                return
              }
              const dx = event.clientX - pointer.x
              const dy = event.clientY - pointer.y
              if (pointer.dragging || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
                pointer.dragging = true
                setDragPosition({ x: pointer.origin.x + dx, y: pointer.origin.y + dy })
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
                onMove(
                  clampChip(
                    {
                      x: pointer.origin.x + event.clientX - pointer.x,
                      y: pointer.origin.y + event.clientY - pointer.y
                    },
                    viewport
                  )
                )
                setDragPosition(null)
              } else {
                onRestore()
              }
            }}
          >
            <HubStateIndicator kind={kind} />
            {agent ? <AgentIcon agent={agent} size={13} /> : null}
            <span className="min-w-0 truncate text-[12px] font-medium">{chip.target.title}</span>
            <button
              type="button"
              aria-label={translate('agentHub.mirror.close', 'Close mirror')}
              onClick={onClose}
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 group-hover/chip:opacity-100 hover:bg-foreground/[0.07] hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side={position.y < BUBBLE_FLIP_Y ? 'bottom' : 'top'} sideOffset={6}>
          {translate('agentHub.mirror.chipTooltip', 'Click to restore · drag to move')}
        </TooltipContent>
      </Tooltip>
      {alert ? (
        <AgentHubAlertStack
          // The queue keeps one alert per pane, so a chip shows at most one.
          alerts={[alert]}
          anchorRef={chipRef}
          side={position.y < BUBBLE_FLIP_Y ? 'bottom' : 'top'}
          locationOf={() => location}
          onOpen={onOpenAlert}
          onDismiss={onDismissAlert}
        />
      ) : null}
    </>
  )
}
