import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { translate } from '@/i18n/i18n'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubStateIndicator } from './AgentHubAtoms'
import { AgentHubAlertBubble } from './AgentHubAlertBubble'
import type { AgentHubAlert } from './agent-hub-alerts'
import { agentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubMirrorChip as ChipState } from './agent-hub-mirror-store'
import type { AgentHubLocation } from './agent-hub-pane-target'

const DRAG_THRESHOLD_PX = 4
// Keeps a chip reachable after a window resize; the status bar owns the bottom strip.
const EDGE_GAP = 8
const BOTTOM_RESERVE = 32
const ESTIMATED_CHIP_WIDTH = 200
const CHIP_HEIGHT = 32
// Near the top, the alert hangs below the chip instead of off screen.
const BUBBLE_FLIP_Y = 160

function clampChip(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(
      Math.max(EDGE_GAP, position.x),
      window.innerWidth - ESTIMATED_CHIP_WIDTH - EDGE_GAP
    ),
    y: Math.min(Math.max(EDGE_GAP, position.y), window.innerHeight - CHIP_HEIGHT - BOTTOM_RESERVE)
  }
}

/** A minimized mirror: drag it anywhere, click to restore, and it speaks up when its agent does. */
export function AgentHubMirrorChip({
  chip,
  thread,
  location,
  alert,
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
  onRestore: () => void
  onClose: () => void
  onMove: (position: { x: number; y: number }) => void
  onOpenAlert: (alert: AgentHubAlert) => void
  onDismissAlert: (id: string) => void
}): React.JSX.Element {
  const chipRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const position = clampChip(dragPosition ?? chip)
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
            data-kind={kind}
            style={{ left: position.x, top: position.y }}
            // Why z-[46]: the mirror window's own layer, over the floating workspace panel.
            className="group/chip fixed z-[46] flex h-8 max-w-[240px] cursor-pointer touch-none items-center gap-2 rounded-full border border-foreground/25 bg-popover pr-1 pl-2.5 text-popover-foreground shadow-floating select-none data-[kind=ask]:border-agent-question/60"
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                (event.target instanceof Element && event.target.closest('button'))
              ) {
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
              const dx = event.clientX - pointer.x
              const dy = event.clientY - pointer.y
              if (pointer.dragging || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
                pointer.dragging = true
                setDragPosition({ x: chip.x + dx, y: chip.y + dy })
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
                  clampChip({
                    x: chip.x + event.clientX - pointer.x,
                    y: chip.y + event.clientY - pointer.y
                  })
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
        <AgentHubAlertBubble
          key={alert.id}
          alert={alert}
          // The queue keeps one alert per pane, so a chip never has more waiting.
          pending={1}
          anchorRef={chipRef}
          side={position.y < BUBBLE_FLIP_Y ? 'bottom' : 'top'}
          location={location}
          onOpen={onOpenAlert}
          onDismiss={onDismissAlert}
        />
      ) : null}
    </>
  )
}
