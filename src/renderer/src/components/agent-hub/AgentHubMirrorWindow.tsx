import { useAgentHubMirrorSelectionFocus } from './use-agent-hub-mirror-selection-focus'
import { agentHubMirrorPanelId, agentHubMirrorTabId } from './AgentHubMirrorTabStrip'
import type { AgentHubMirrorWindowState } from './agent-hub-mirror-membership'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { ChevronRight, Loader2, PanelsTopLeft } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { HubAvatar, HubCrumb, HubStateIndicator } from './AgentHubAtoms'
import { agentHubIndicatorKind, type AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'
import { AgentHubMirrorHeaderControls } from './AgentHubMirrorHeaderControls'
import { AgentHubMirrorDictationOverlay } from './AgentHubMirrorDictationOverlay'
import { AgentHubMirrorFamilyTabs } from './AgentHubMirrorFamilyTabs'
import { AgentHubMirrorFocusShade } from './AgentHubMirrorFocusShade'
import { AgentHubMirrorSidebarReveal } from './AgentHubMirrorSidebarReveal'
import { AgentHubMirrorTitle } from './AgentHubMirrorTitle'
import {
  isAgentHubMirrorStageQuiet,
  useAgentHubMirrorHighlight,
  useAgentHubMirrorsDockRequest
} from './agent-hub-mirror-store'
import { useMirrorWindowDeparture } from './use-mirror-window-departure'
import { nudgeMirrorWindow, pulseMirrorWindow } from './mirror-window-nudge'
import { useMirrorWindowGeometry } from './use-mirror-window-geometry'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubMirrorFamily } from './agent-hub-mirror-family'
import { toggleAgentHubFamilyBar, useAgentHubFamilyBarShown } from './agent-hub-family-bar'
import type { AgentHubThreadCardActions } from './AgentHubThreadHoverCard'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import { returnRetainedPaneDestinationHome } from '../tab-group/retained-pane-destinations'

// A tab that has not attached by then is not coming back on its own.
const ATTACH_GIVE_UP_MS = 10_000

/**
 * Non-modal, draggable window around one terminal pane. The real pane is moved in through the
 * terminal portal Activity uses, so it is the terminal itself: same renderer, input, scrollback
 * and mouse. It fits the window while here and returns to its place on close.
 */
export function AgentHubMirrorWindow({
  windowId,
  windowState,
  tabStrip,
  target,
  windowKind,
  thread,
  location,
  stackIndex,
  besideHubPanel,
  previewFocus = true,
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
  windowId: string
  windowState?: AgentHubMirrorWindowState
  tabStrip?: React.ReactNode
  windowKind?: AgentHubIndicatorKind
  target: AgentHubPaneTarget
  /** Live thread for an agent pane, for its state glyph; null for a shell. */
  thread: AgentPaneThread | null
  location: AgentHubLocation
  /** Its place in the stack of open mirrors (higher is in front). */
  stackIndex: number
  /** The hub's panel is open: a window opening now takes a place beside it. */
  besideHubPanel: boolean
  previewFocus?: boolean
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
  onFocus: (event: React.PointerEvent<HTMLElement>) => void
  onClose: () => void
  /** Parks the window as a chip beside the hub; the mirror keeps running. */
  onMinimize: () => void
  onReveal: () => void
}): React.JSX.Element {
  const mirrorKey = windowId
  const reducedMotion = usePrefersReducedMotion()
  const previousSlotRef = useRef<HTMLDivElement | null>(null)
  const { geometry, focus, settling, sectionRef, beginDrag, onPointerMove, endDrag, cancelDrag } =
    useMirrorWindowGeometry(mirrorKey, besideHubPanel)
  const slotRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element && previousSlotRef.current) {
        returnRetainedPaneDestinationHome(previousSlotRef.current)
      }
      previousSlotRef.current = element
      onSlot(mirrorKey, element)
    },
    [onSlot, mirrorKey]
  )
  const ptyId = useAgentHubLivePty(
    target.worktree.id,
    target.tab.id,
    target.paneKey,
    surface === 'portal'
  )
  const [gaveUp, setGaveUp] = useState(false)
  // Put back at launch: it is simply there, without the opening animation.
  const [restored] = useState(isAgentHubMirrorStageQuiet)
  const { leaving, minimizing, leave, minimize } = useMirrorWindowDeparture(
    mirrorKey,
    windowState,
    sectionRef,
    hubRef,
    onMinimize
  )
  // Picked again from the hub while open: glow so the eye finds it.
  const highlight = useAgentHubMirrorHighlight()
  const seenHighlight = useRef(highlight.seq)
  useEffect(() => {
    if (highlight.seq === seenHighlight.current) {
      return
    }
    seenHighlight.current = highlight.seq
    if (highlight.key === mirrorKey && sectionRef.current) {
      minimizing.current = false
      if (!reducedMotion) {
        pulseMirrorWindow(sectionRef.current)
      }
    }
  }, [highlight, mirrorKey, sectionRef, minimizing, reducedMotion])
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
  const activeKind = thread ? agentHubIndicatorKind(thread) : 'idle'
  const kind = windowKind ?? activeKind
  useAgentHubMirrorSelectionFocus({
    windowId,
    tabId: windowState?.activeTabId ?? '',
    target,
    rootRef: sectionRef,
    allowed: previewFocus && surface !== 'in-workspace',
    preview: surface === 'preview'
  })
  const familyRoot = family?.path[0]?.paneKey ?? null
  const familyBarShown = useAgentHubFamilyBarShown(familyRoot)

  const nudgeId = nudge?.id
  const nudgeKind = nudge?.kind
  useEffect(() => {
    if (!nudgeId || !nudgeKind || !sectionRef.current) {
      return
    }
    if (!reducedMotion) {
      nudgeMirrorWindow(sectionRef.current, nudgeKind)
    }
    onNudged(nudgeId)
  }, [nudgeId, nudgeKind, onNudged, sectionRef, reducedMotion])

  useEffect(() => {
    setGaveUp(false)
    if (ptyId) {
      return
    }
    const timer = setTimeout(() => setGaveUp(true), ATTACH_GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [ptyId, target.tab.id, target.paneKey])

  return (
    <section
      ref={sectionRef}
      role="dialog"
      aria-label={target.title}
      data-agent-hub-mirror
      data-agent-hub-mirror-key={mirrorKey}
      data-settling={settling}
      data-focus={focus ?? undefined}
      data-leaving={leaving}
      data-restored={restored}
      data-kind={kind}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Why the strong edge: the mirror floats over terminals that share its background.
      className="group/mirror pointer-events-auto fixed flex animate-in flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background shadow-floating data-[kind=ask]:border-agent-question/60 data-[kind=done]:border-status-success/50 duration-150 fade-in-0 zoom-in-95 data-[leaving=true]:animate-out data-[leaving=true]:fade-out-0 data-[leaving=true]:zoom-out-95 data-[leaving=true]:[animation-fill-mode:forwards] data-[restored=true]:data-[leaving=false]:animate-none data-[settling=true]:transition-[left,top,width,height] data-[settling=true]:duration-300 data-[settling=true]:ease-out motion-reduce:animate-none! motion-reduce:transition-none!"
      style={{
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        zIndex: stackIndex
      }}
      onPointerDownCapture={onFocus}
      onKeyDown={(event) => {
        // Esc belongs to the terminal or its open menu before it belongs to the mirror.
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          !event.nativeEvent.isComposing &&
          !(
            event.target instanceof HTMLElement &&
            event.target.closest(
              '.xterm, [role="menu"], input, textarea, [contenteditable="true"], [data-agent-hub-picker]'
            )
          )
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
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
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
        {tabStrip ?? (
          <>
            <HubStateIndicator kind={activeKind} />
            <HubAvatar agentType={target.agentType} kind={thread ? activeKind : null} />
            <div className="min-w-0 flex-1 text-[12.5px] leading-tight">
              <AgentHubMirrorTitle key={windowState?.activeTabId} target={target} />
              <div className="flex items-center gap-1 [&>span]:text-[11px]">
                <HubCrumb location={location} />
                <AgentHubMirrorSidebarReveal target={target} />
              </div>
            </div>
          </>
        )}
        {tabStrip ? <div aria-hidden className="min-w-4 flex-1 self-stretch" /> : null}
        <AgentHubMirrorHeaderControls
          target={target}
          reachable={surface !== 'preview'}
          mirrorKey={mirrorKey}
          focused={focus === 'focused'}
          showJump={(windowState?.tabs.length ?? 1) === 1}
          onReveal={onReveal}
          onMinimize={() => minimize()}
          onClose={() => leave(onClose)}
        />
      </header>
      <div
        role="tabpanel"
        id={agentHubMirrorPanelId(windowId)}
        aria-labelledby={windowState ? agentHubMirrorTabId(windowState.activeTabId) : undefined}
        className="flex min-h-0 flex-1 flex-col"
      >
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
        ) : surface !== 'preview' ? (
          // The real pane renders in here (see AgentHubMirrors); it fits and resizes like any pane.
          <div ref={slotRef} data-agent-hub-mirror-slot className="relative min-h-0 flex-1">
            <AgentHubMirrorDictationOverlay target={target} showsTerminal />
            {ptyId ? null : (
              <div className="absolute inset-0 flex items-start gap-2 px-3.5 py-3 font-mono text-xs text-muted-foreground">
                {gaveUp ? (
                  translate(
                    'agentHub.mirror.noTerminal',
                    'This pane has no live terminal right now.'
                  )
                ) : (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {translate('agentHub.mirror.connecting', 'Connecting to the terminal…')}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div ref={slotRef} data-agent-hub-mirror-slot className="relative min-h-0 flex-1" />
        )}
      </div>
      <div
        aria-hidden
        className="absolute right-0 bottom-0 size-3 cursor-nwse-resize group-data-[focus=focused]/mirror:hidden"
        onPointerDown={beginDrag('resize')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
      />
      <AgentHubMirrorFocusShade layer="mirror" shown={focus === 'shadowed'} />
    </section>
  )
}
