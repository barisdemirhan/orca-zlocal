import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { ChevronRight, Loader2, Minus, PanelsTopLeft, PictureInPicture2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
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
import { AgentHubArrangeMenu } from './AgentHubArrangeMenu'
import { AgentHubDimToggle } from './AgentHubDimToggle'
import { AgentHubMirrorDictationOverlay } from './AgentHubMirrorDictationOverlay'
import { AgentHubMirrorFamilyTabs } from './AgentHubMirrorFamilyTabs'
import { AgentHubMirrorMicButton } from './AgentHubMirrorMicButton'
import { AgentHubMirrorTitle } from './AgentHubMirrorTitle'
import {
  requestAgentHubMirrorsDock,
  useAgentHubMirrorHighlight,
  useAgentHubMirrorsDockRequest
} from './agent-hub-mirror-store'
import { flyMirrorWindowToHub } from './mirror-window-flight'
import { nudgeMirrorWindow, pulseMirrorWindow } from './mirror-window-nudge'
import { useMirrorWindowGeometry } from './use-mirror-window-geometry'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubMirrorFamily } from './agent-hub-mirror-family'
import { toggleAgentHubFamilyBar, useAgentHubFamilyBarShown } from './agent-hub-family-bar'
import type { AgentHubThreadCardActions } from './AgentHubThreadHoverCard'
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
  besideHubPanel,
  surface,
  nudge,
  onNudged,
  family,
  locationOf,
  familyActionsFor,
  onRetarget,
  hubRef,
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
  /** The hub's panel is open: a window opening now takes a place beside it. */
  besideHubPanel: boolean
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
  /** Where a family member runs, for its hover card. */
  locationOf: (thread: AgentPaneThread) => AgentHubLocation
  familyActionsFor: (thread: AgentPaneThread) => AgentHubThreadCardActions
  onRetarget: (thread: AgentPaneThread) => void
  /** The hub the window flies into when minimized. */
  hubRef: React.RefObject<HTMLElement | null>
  /** Registers the box the real pane is moved into. */
  onSlot: (key: string, element: HTMLDivElement | null) => void
  onFocus: () => void
  onClose: () => void
  /** Parks the window as a chip beside the hub; the mirror keeps running. */
  onMinimize: () => void
  onReveal: () => void
}): React.JSX.Element {
  const mirrorKey = agentHubPaneTargetKey(target)
  const { geometry, settling, sectionRef, beginDrag, onPointerMove, endDrag } =
    useMirrorWindowGeometry(mirrorKey, besideHubPanel)
  const slotRef = useCallback(
    (element: HTMLDivElement | null) => onSlot(mirrorKey, element),
    [onSlot, mirrorKey]
  )
  const ptyId = useAgentHubLivePty(
    target.worktree.id,
    target.tab.id,
    target.paneKey,
    surface === 'portal'
  )
  const [gaveUp, setGaveUp] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Fades the window out before it closes or shrinks into its chip.
  const leave = (then: () => void): void => {
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
  const minimizing = useRef(false)
  const minimize = (delayMs = 0): void => {
    if (minimizing.current || !sectionRef.current) {
      return
    }
    minimizing.current = true
    flyMirrorWindowToHub(sectionRef.current, hubRef.current, onMinimize, delayMs)
  }
  // Picked again from the hub while open: glow so the eye finds it.
  const highlight = useAgentHubMirrorHighlight()
  const seenHighlight = useRef(highlight.seq)
  useEffect(() => {
    if (highlight.seq === seenHighlight.current) {
      return
    }
    seenHighlight.current = highlight.seq
    if (highlight.key === mirrorKey && sectionRef.current) {
      pulseMirrorWindow(sectionRef.current)
    }
  }, [highlight, mirrorKey, sectionRef])
  // "Send all to the hub" reaches every open window, the front one first; a hub row asks one.
  const dockRequest = useAgentHubMirrorsDockRequest()
  const seenDockRequest = useRef(dockRequest.seq)
  const dockWhenAsked = useEffectEvent(() => {
    if (dockRequest.key === null) {
      minimize(Math.max(0, 4 - stackIndex) * 45)
    } else if (dockRequest.key === mirrorKey) {
      minimize()
    }
  })
  useEffect(() => {
    if (dockRequest.seq !== seenDockRequest.current) {
      seenDockRequest.current = dockRequest.seq
      dockWhenAsked()
    }
  }, [dockRequest])
  // Why subscribed: an agent starting or exiting in this pane changes its key encodings.
  const terminalInput = useAppStore(
    useShallow((state) =>
      surface === 'preview' && ptyId ? resolveAgentHubTerminalInput(state, target, ptyId) : null
    )
  )
  const kind = thread ? agentHubIndicatorKind(thread) : 'idle'
  const dockAllShortcut = useOptionalShortcutLabel('agentHub.dockMirrors')
  const familyRoot = family?.path[0]?.paneKey ?? null
  const familyBarShown = useAgentHubFamilyBarShown(familyRoot)

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
      data-agent-hub-mirror-key={mirrorKey}
      data-settling={settling}
      data-leaving={leaving}
      data-kind={kind}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Why the strong edge: the mirror floats over terminals that share its background.
      className="group/mirror pointer-events-auto fixed flex animate-in flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background shadow-floating data-[kind=ask]:border-agent-question/60 data-[kind=done]:border-status-success/50 duration-150 fade-in-0 zoom-in-95 data-[leaving=true]:animate-out data-[leaving=true]:fade-out-0 data-[leaving=true]:zoom-out-95 data-[leaving=true]:[animation-fill-mode:forwards] data-[settling=true]:transition-[left,top,width,height] data-[settling=true]:duration-300 data-[settling=true]:ease-out"
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
        {familyRoot ? (
          // A disclosure arrow by the title folds the workers bar away, like a tree row.
          <button
            type="button"
            aria-label={
              familyBarShown
                ? translate('agentHub.mirror.hideWorkers', 'Hide the workers bar')
                : translate('agentHub.mirror.showWorkers', 'Show the workers bar')
            }
            title={
              familyBarShown
                ? translate('agentHub.mirror.hideWorkers', 'Hide the workers bar')
                : translate('agentHub.mirror.showWorkers', 'Show the workers bar')
            }
            aria-expanded={familyBarShown}
            onClick={() => toggleAgentHubFamilyBar(familyRoot)}
            className="-mr-1 -ml-1.5 grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <ChevronRight
              data-open={familyBarShown}
              className="size-3 transition-transform duration-150 data-[open=true]:rotate-90"
            />
          </button>
        ) : null}
        <HubStateIndicator kind={kind} />
        <HubAvatar agentType={target.agentType} kind={thread ? kind : null} />
        <div className="min-w-0 flex-1 text-[12.5px]">
          <AgentHubMirrorTitle target={target} />
          <div className="[&>span]:text-[11px]">
            <HubCrumb location={location} />
          </div>
        </div>
        {/* The window's controls sit close together, apart from the title. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <AgentHubDimToggle appearance="mirror" />
          <AgentHubMirrorMicButton target={target} reachable={surface !== 'preview'} />
          <button
            type="button"
            title={translate('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')}
            onClick={onReveal}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
          >
            {translate('agentHub.mirror.jump', 'Jump')}
            <HubKeys keys={['↵']} />
          </button>
          <AgentHubArrangeMenu>
            <button
              type="button"
              aria-label={translate('agentHub.mirror.dockAll', 'Send all mirrors to the hub')}
              title={
                dockAllShortcut
                  ? `${translate('agentHub.mirror.dockAll', 'Send all mirrors to the hub')} (${dockAllShortcut})`
                  : translate('agentHub.mirror.dockAll', 'Send all mirrors to the hub')
              }
              onClick={() => requestAgentHubMirrorsDock()}
              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
            >
              <PictureInPicture2 className="size-3.5" />
            </button>
          </AgentHubArrangeMenu>
          <button
            type="button"
            aria-label={translate('agentHub.mirror.minimize', 'Minimize')}
            title={translate('agentHub.mirror.minimize', 'Minimize')}
            onClick={() => minimize()}
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
        </div>
      </header>
      {family && familyBarShown ? (
        <AgentHubMirrorFamilyTabs
          family={family}
          activeKey={target.paneKey ?? thread?.paneKey ?? mirrorKey}
          locationOf={locationOf}
          actionsFor={familyActionsFor}
          onSelect={onRetarget}
        />
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
            onClick={() => minimize()}
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
          <AgentHubMirrorDictationOverlay target={target} showsTerminal />
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
