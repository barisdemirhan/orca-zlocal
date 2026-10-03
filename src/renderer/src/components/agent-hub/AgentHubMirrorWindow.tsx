import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Minus, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubAvatar, HubCrumb, HubKeys, HubStateIndicator } from './AgentHubAtoms'
import { agentHubIndicatorKind } from './agent-hub-lists'
import {
  agentHubPaneTargetKey,
  resolveAgentHubTerminalInput,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import {
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { readAgentHubMirrorOrigin, rememberAgentHubMirrorOrigin } from './agent-hub-mirror-store'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

const LEAVE_MS = 140
const CASCADE_STEP_PX = 28
// Main serializes at most this many history rows into a preview.
// A tab that has not attached by then is not coming back on its own.
const ATTACH_GIVE_UP_MS = 10_000

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
 * Non-modal, draggable window around one terminal pane. The real pane is moved in through the
 * terminal portal Activity uses, so it is the terminal itself: same renderer, input, scrollback
 * and mouse. It fits the window while here and returns to its place on close.
 */
export function AgentHubMirrorWindow({
  target,
  thread,
  location,
  stackIndex,
  cascade,
  surface,
  onSlot,
  onFocus,
  onClose,
  onMinimize,
  onReveal
}: {
  target: AgentHubPaneTarget
  /** Live thread for an agent pane, for its state glyph; null for a shell. */
  thread: AgentPaneThread | null
  location: AgentHubLocation
  /** Its place in the stack of open mirrors (higher is in front). */
  stackIndex: number
  /** How many mirrors were open before it: a new one steps off the last so neither hides the other. */
  cascade: number
  /**
   * How the terminal is shown: the real pane moved in (`portal`), a note while the pane is on
   * screen in the workspace (`in-workspace`), or the dashboard's preview for floating terminals.
   */
  surface: 'portal' | 'in-workspace' | 'preview'
  /** Registers the box the real pane is moved into. */
  onSlot: (key: string, element: HTMLDivElement | null) => void
  onFocus: () => void
  onClose: () => void
  /** Shrinks the window into a chip where it stands; the mirror keeps running. */
  onMinimize: () => void
  onReveal: () => void
}): React.JSX.Element {
  const [geometry, setGeometry] = useState<AgentHubMirrorGeometry>(() => {
    const base = lastGeometry ?? defaultAgentHubMirrorGeometry(viewportSize())
    // A restored chip reopens where it was dragged to.
    const origin = readAgentHubMirrorOrigin(agentHubPaneTargetKey(target))
    const step = CASCADE_STEP_PX * cascade
    return clampAgentHubMirrorGeometry(
      origin ? { ...base, ...origin } : { ...base, x: base.x - step, y: base.y - step },
      viewportSize()
    )
  })
  const dragRef = useRef<DragState | null>(null)
  const mirrorKey = agentHubPaneTargetKey(target)
  const slotRef = useCallback(
    (element: HTMLDivElement | null) => onSlot(mirrorKey, element),
    [onSlot, mirrorKey]
  )
  const ptyId = useAgentHubLivePty(target.worktree.id, target.tab.id, target.paneKey)
  const [gaveUp, setGaveUp] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Fades the window out before it closes or shrinks into its chip.
  const leave = (then: () => void): void => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      then()
      return
    }
    setLeaving(true)
    leaveTimerRef.current = setTimeout(then, LEAVE_MS)
  }
  useEffect(
    () => () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current)
      }
    },
    []
  )
  // Why subscribed: an agent starting or exiting in this pane changes its key encodings.
  const terminalInput = useAppStore(
    useShallow((state) =>
      surface === 'preview' && ptyId ? resolveAgentHubTerminalInput(state, target, ptyId) : null
    )
  )
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'

  useEffect(() => {
    lastGeometry = geometry
    rememberAgentHubMirrorOrigin(mirrorKey, { x: geometry.x, y: geometry.y })
  }, [geometry, mirrorKey])

  useEffect(() => {
    if (ptyId) {
      return
    }
    const timer = setTimeout(() => setGaveUp(true), ATTACH_GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [ptyId])

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

  return (
    <section
      role="dialog"
      aria-label={target.title}
      data-agent-hub-mirror
      data-leaving={leaving}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Why the strong edge: the mirror floats over terminals that share its background.
      className="pointer-events-auto fixed flex animate-in flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background shadow-floating duration-150 fade-in-0 zoom-in-95 data-[leaving=true]:animate-out data-[leaving=true]:fade-out-0 data-[leaving=true]:zoom-out-95 data-[leaving=true]:[animation-fill-mode:forwards] motion-reduce:animate-none"
      style={{
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        zIndex: stackIndex
      }}
      onPointerDownCapture={onFocus}
      onKeyDown={(event) => {
        // Why: Esc inside the terminal belongs to the agent (interrupt), not to the window.
        if (
          event.key === 'Escape' &&
          !(event.target instanceof HTMLElement && event.target.closest('.xterm'))
        ) {
          event.preventDefault()
          leave(onClose)
        }
      }}
    >
      <header
        className="flex h-[42px] shrink-0 cursor-grab items-center gap-[9px] border-b border-border bg-popover pr-1.5 pl-3 select-none active:cursor-grabbing"
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <HubStateIndicator kind={kind} />
        <HubAvatar agentType={target.agentType} kind={thread ? kind : null} />
        <div className="min-w-0 flex-1 text-[12.5px]">
          <div className="truncate font-semibold">{target.title}</div>
          <div className="[&>span]:text-[11px]">
            <HubCrumb location={location} />
          </div>
        </div>
        <button
          type="button"
          onClick={onReveal}
          className="flex items-center gap-1.5 rounded-[7px] px-[7px] py-[5px] text-xs text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {translate('agentHub.mirror.openInOrca', 'Open in Orca')}
          <HubKeys keys={['↵']} />
        </button>
        <button
          type="button"
          aria-label={translate('agentHub.mirror.minimize', 'Minimize')}
          title={translate('agentHub.mirror.minimize', 'Minimize')}
          onClick={() => leave(onMinimize)}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={translate('agentHub.mirror.close', 'Close mirror')}
          onClick={() => leave(onClose)}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </header>
      {surface === 'in-workspace' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
          {translate(
            'agentHub.mirror.inWorkspace',
            'This terminal is on screen in the workspace; it comes back here when you leave it.'
          )}
        </div>
      ) : surface === 'preview' && ptyId ? (
        <AgentTerminalPreview
          key={ptyId}
          ptyId={ptyId}
          terminalInput={terminalInput}
          className="h-auto min-h-0 flex-1"
        />
      ) : (
        // The real pane renders in here (see AgentHubMirrors); it fits and resizes like any pane.
        <div ref={slotRef} data-agent-hub-mirror-slot className="relative min-h-0 flex-1">
          {ptyId ? null : (
            <div className="absolute inset-0 flex items-start gap-2 px-3.5 py-3 font-mono text-xs text-muted-foreground">
              {gaveUp ? (
                translate('agentHub.mirror.noTerminal', 'This pane has no live terminal right now.')
              ) : (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {translate('agentHub.mirror.connecting', 'Connecting to the terminal…')}
                </>
              )}
            </div>
          )}
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
    </section>
  )
}
