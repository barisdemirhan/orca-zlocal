import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Minus, PanelsTopLeft, X } from 'lucide-react'
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
import { useAgentHubLivePty } from './use-agent-hub-live-pty'
import { AgentHubDimToggle } from './AgentHubDimToggle'
import { AgentHubMirrorFamilyTabs } from './AgentHubMirrorFamilyTabs'
import { AgentHubMirrorTitle } from './AgentHubMirrorTitle'
import { nudgeMirrorWindow } from './mirror-window-nudge'
import { useMirrorWindowGeometry } from './use-mirror-window-geometry'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubMirrorFamily } from './agent-hub-mirror-family'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'

const LEAVE_MS = 140
// A tab that has not attached by then is not coming back on its own.
const ATTACH_GIVE_UP_MS = 10_000

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
  nudge,
  onNudged,
  family,
  onRetarget,
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
  /** An alert for this pane, shown by the window itself rather than by the hub. */
  nudge: AgentHubAlert | null
  onNudged: (id: string) => void
  /** Where this pane sits among dispatchers and workers; null outside orchestration. */
  family: AgentHubMirrorFamily | null
  onRetarget: (thread: AgentPaneThread) => void
  /** Registers the box the real pane is moved into. */
  onSlot: (key: string, element: HTMLDivElement | null) => void
  onFocus: () => void
  onClose: () => void
  /** Shrinks the window into a chip where it stands; the mirror keeps running. */
  onMinimize: () => void
  onReveal: () => void
}): React.JSX.Element {
  const mirrorKey = agentHubPaneTargetKey(target)
  const { geometry, sectionRef, beginDrag, onPointerMove, endDrag } = useMirrorWindowGeometry(
    mirrorKey,
    cascade
  )
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

  const nudgeId = nudge?.id
  const nudgeKind = nudge?.kind
  useEffect(() => {
    if (!nudgeId || !nudgeKind || !sectionRef.current) {
      return
    }
    nudgeMirrorWindow(sectionRef.current, nudgeKind)
    onNudged(nudgeId)
  }, [nudgeId, nudgeKind, onNudged, sectionRef])

  useEffect(() => {
    if (ptyId) {
      return
    }
    const timer = setTimeout(() => setGaveUp(true), ATTACH_GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [ptyId])

  return (
    <section
      ref={sectionRef}
      role="dialog"
      aria-label={target.title}
      data-agent-hub-mirror
      data-leaving={leaving}
      data-kind={kind}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Why the strong edge: the mirror floats over terminals that share its background.
      className="group/mirror pointer-events-auto fixed flex animate-in flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background shadow-floating data-[kind=ask]:border-agent-question/60 data-[kind=done]:border-status-success/50 duration-150 fade-in-0 zoom-in-95 data-[leaving=true]:animate-out data-[leaving=true]:fade-out-0 data-[leaving=true]:zoom-out-95 data-[leaving=true]:[animation-fill-mode:forwards] motion-reduce:animate-none"
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
        // Why tinted: a mirror whose agent asks or just finished should read so at a glance.
        className="flex h-[42px] shrink-0 cursor-grab items-center gap-[9px] border-b border-border bg-popover pr-1.5 pl-3 transition-colors select-none active:cursor-grabbing group-data-[kind=ask]/mirror:border-agent-question/40 group-data-[kind=ask]/mirror:bg-agent-question/15 group-data-[kind=done]/mirror:border-status-success/35 group-data-[kind=done]/mirror:bg-status-success/12"
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <HubStateIndicator kind={kind} />
        <HubAvatar agentType={target.agentType} kind={thread ? kind : null} />
        <div className="min-w-0 flex-1 text-[12.5px]">
          <AgentHubMirrorTitle target={target} />
          <div className="[&>span]:text-[11px]">
            <HubCrumb location={location} />
          </div>
        </div>
        <AgentHubDimToggle appearance="mirror" />
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
      {family ? (
        <AgentHubMirrorFamilyTabs family={family} activeKey={mirrorKey} onSelect={onRetarget} />
      ) : null}
      {surface === 'in-workspace' ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-popover/60 px-8 text-center">
          <PanelsTopLeft className="size-6 text-muted-foreground" />
          <div className="text-sm font-semibold">
            {translate('agentHub.mirror.inWorkspaceTitle', "You're in this workspace")}
          </div>
          <p className="max-w-[340px] text-xs text-muted-foreground">
            {translate(
              'agentHub.mirror.inWorkspace',
              'This pane is on screen in your current workspace, so it stays there. It moves back into this window when you switch to another tab or workspace.'
            )}
          </p>
          <button
            type="button"
            onClick={() => leave(onMinimize)}
            className="mt-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          >
            {translate('agentHub.mirror.minimize', 'Minimize')}
          </button>
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
