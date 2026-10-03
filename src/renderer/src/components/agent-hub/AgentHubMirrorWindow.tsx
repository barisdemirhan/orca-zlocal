import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SquareArrowOutUpRight, SquareTerminal, XIcon } from 'lucide-react'
import { useAppStore } from '@/store'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import { threadAgentState } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import {
  resolveAgentHubPtyId,
  resolveAgentHubTerminalInput,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import {
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'

// Why module scope: reopening the mirror lands where the user last left it this session.
let lastGeometry: AgentHubMirrorGeometry | null = null

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

type DragState = {
  mode: 'move' | 'resize'
  pointerX: number
  pointerY: number
  start: AgentHubMirrorGeometry
}

/**
 * Non-modal, draggable live mirror of one terminal pane. The preview claims the PTY grid
 * while open (see createPreviewGridClaim), so the real pane follows the mirror's size
 * until it closes.
 */
export function AgentHubMirrorWindow({
  target,
  thread,
  subtitle,
  onClose,
  onReveal
}: {
  target: AgentHubPaneTarget
  /** Live thread for an agent pane, for its state glyph; null for a shell. */
  thread: AgentPaneThread | null
  subtitle: string
  onClose: () => void
  onReveal: () => void
}): React.JSX.Element {
  const [geometry, setGeometry] = useState<AgentHubMirrorGeometry>(() =>
    clampAgentHubMirrorGeometry(
      lastGeometry ?? defaultAgentHubMirrorGeometry(viewportSize()),
      viewportSize()
    )
  )
  const dragRef = useRef<DragState | null>(null)
  const ptyId = useAppStore((s) => resolveAgentHubPtyId(s, target.tab.id, target.paneKey))
  const terminalInput = useMemo(
    () => (ptyId ? resolveAgentHubTerminalInput(useAppStore.getState(), target, ptyId) : null),
    [ptyId, target]
  )

  useEffect(() => {
    lastGeometry = geometry
  }, [geometry])

  useEffect(() => {
    const onResize = (): void =>
      setGeometry((current) => clampAgentHubMirrorGeometry(current, viewportSize()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const beginDrag = useCallback(
    (mode: DragState['mode']) =>
      (event: React.PointerEvent<HTMLElement>): void => {
        const onButton = event.target instanceof Element && event.target.closest('button') !== null
        if (event.button !== 0 || (mode === 'move' && onButton)) {
          return
        }
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
          mode,
          pointerX: event.clientX,
          pointerY: event.clientY,
          start: geometry
        }
      },
    [geometry]
  )

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY
    const next =
      drag.mode === 'move'
        ? { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }
        : { ...drag.start, width: drag.start.width + dx, height: drag.start.height + dy }
    setGeometry(clampAgentHubMirrorGeometry(next, viewportSize()))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    if (dragRef.current) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const agent = agentTypeToIconAgent(target.agentType)

  return createPortal(
    <section
      role="dialog"
      aria-label={target.title}
      data-agent-hub-mirror
      // Why z-[46]: above the floating workspace panel (z-45), below modal layers (z-50).
      className="fixed z-[46] flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-floating"
      style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
      onKeyDown={(event) => {
        // Why: Esc inside the terminal belongs to the agent (interrupt), not to the window.
        if (
          event.key === 'Escape' &&
          !(event.target instanceof HTMLElement && event.target.closest('.xterm'))
        ) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header
        className="flex shrink-0 cursor-grab items-center gap-2 border-b border-border px-2.5 py-1.5 select-none active:cursor-grabbing"
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {thread ? <AgentStateDot state={threadAgentState(thread)} /> : null}
        <span className="inline-flex shrink-0 text-muted-foreground">
          {agent ? <AgentIcon agent={agent} size={14} /> : <SquareTerminal className="size-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{target.title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={onReveal}>
          <SquareArrowOutUpRight className="size-3" />
          {translate('agentHub.mirror.openInOrca', 'Open in Orca')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={translate('agentHub.mirror.close', 'Close mirror')}
          onClick={onClose}
        >
          <XIcon className="size-3.5" />
        </Button>
      </header>
      {ptyId ? (
        <AgentTerminalPreview
          key={ptyId}
          ptyId={ptyId}
          terminalInput={terminalInput}
          className="h-auto min-h-0 flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 px-3 py-2 text-xs text-muted-foreground">
          {translate('agentHub.mirror.noTerminal', 'This pane has no live terminal right now.')}
        </div>
      )}
      <div
        aria-hidden
        className="absolute right-0 bottom-0 size-3 cursor-nwse-resize"
        onPointerDown={beginDrag('resize')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </section>,
    document.body
  )
}
