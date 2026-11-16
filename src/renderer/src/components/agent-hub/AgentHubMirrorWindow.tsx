import { AgentHubPaneSleepOverlay } from './AgentHubPaneSleepOverlay'
import { useAgentHubTargetTitle } from './AgentHubMirrorTitle'
import { Button } from '@/components/ui/button'
import { useAgentHubMirrorSelectionFocus } from './use-agent-hub-mirror-selection-focus'
import { agentHubMirrorPanelId, agentHubMirrorTabId } from './AgentHubMirrorTabStrip'
import type { AgentHubMirrorWindowState } from './agent-hub-mirror-membership'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Loader2, PanelsTopLeft } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { isAgentHubChatTab } from './agent-hub-chat-tabs'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { agentHubIndicatorKind, type AgentHubIndicatorKind } from './agent-hub-lists'
import type { AgentHubLocation, AgentHubPaneTarget } from './agent-hub-pane-target'
import { useAgentHubLivePty } from './use-agent-hub-live-pty'
import { AgentHubMirrorHeaderControls } from './AgentHubMirrorHeaderControls'
import { AgentHubMirrorDictationOverlay } from './AgentHubMirrorDictationOverlay'
import { AgentHubMirrorFamilyTabs } from './AgentHubMirrorFamilyTabs'
import { AgentHubMirrorFocusShade } from './AgentHubMirrorFocusShade'
import {
  isAgentHubMirrorStageQuiet,
  useAgentHubMirrorHighlight,
  useAgentHubMirrorsDockRequest
} from './agent-hub-mirror-store'
import { useMirrorWindowDeparture } from './use-mirror-window-departure'
import { nudgeMirrorWindow, pulseMirrorWindow } from './mirror-window-nudge'
import { useMirrorWindowGeometry } from './use-mirror-window-geometry'
import type { AgentHubThreadAlert } from './agent-hub-alerts'
import type { AgentHubMirrorFamily } from './agent-hub-mirror-family'
import { useAgentHubFamilyBarShown } from './agent-hub-family-bar'
import type { AgentHubThreadCardActions } from './AgentHubThreadHoverCard'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/composition/status-bar-context-menu-policy'
import { returnRetainedPaneDestinationHome } from '../tab-group/retained-pane-destinations'
import { closeAgentHubAgent } from './agent-hub-close-agent'

// A tab that has not attached by then is not coming back on its own.
const ATTACH_GIVE_UP_MS = 10_000
// How long the still ring stays when the glow cannot move (reduced motion).
const HIGHLIGHT_RING_MS = 1600

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
  shownTarget = target,
  windowKind,
  thread,
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
  onReturnHome,
  hubRef,
  onSlot,
  onFocus,
  onClose,
  onMinimize,
  onReveal
}: {
  windowId: string
  windowState?: AgentHubMirrorWindowState
  tabStrip: React.ReactNode
  windowKind?: AgentHubIndicatorKind
  target: AgentHubPaneTarget
  shownTarget?: AgentHubPaneTarget
  /** Live thread for an agent pane, for its state glyph; null for a shell. */
  thread: AgentPaneThread | null
  /** Its place in the stack of open mirrors (higher is in front). */
  stackIndex: number
  /** The hub's panel is open: a window opening now takes a place beside it. */
  besideHubPanel: boolean
  previewFocus?: boolean
  /**
   * How the terminal is shown: the real pane moved in (`portal`), a note while the pane is on
   * screen in the workspace (`in-workspace`), the dashboard's preview for floating terminals, or
   * a chat's retained view moved in (`chat`).
   */
  surface: 'portal' | 'in-workspace' | 'preview' | 'chat'
  /** An alert for this pane, shown by the window itself rather than by the hub. */
  nudge: AgentHubThreadAlert | null
  onNudged: (id: string) => void
  /** Where this pane sits among dispatchers and workers; null outside orchestration. */
  family: AgentHubMirrorFamily | null
  /** Where a family member runs, for its hover card. */
  locationOf: (thread: AgentPaneThread) => AgentHubLocation
  familyActionsFor: (thread: AgentPaneThread) => AgentHubThreadCardActions
  onRetarget: (thread: AgentPaneThread) => void
  onReturnHome?: () => void
  /** The hub the window flies into when minimized. */
  hubRef: React.RefObject<HTMLElement | null>
  /** Registers the box the real pane is moved into. */
  onSlot: (key: string, element: HTMLDivElement | null) => void
  onFocus: (event: React.PointerEvent<HTMLElement>) => void
  onClose: () => void
  /** Parks the window as a chip beside the hub; the mirror keeps running. `alone` is false while
   * every window goes at once, when nothing is left to lay out again. */
  onMinimize: (alone: boolean) => void
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
    shownTarget.worktree.id,
    shownTarget.tab.id,
    shownTarget.paneKey,
    surface === 'portal' || surface === 'chat'
  )
  const [gaveUp, setGaveUp] = useState(false)
  // Put back at launch: it is simply there, without the opening animation.
  const [restored] = useState(isAgentHubMirrorStageQuiet)
  const dockingAll = useRef(false)
  const { leaving, minimizing, leave, minimize } = useMirrorWindowDeparture(
    mirrorKey,
    windowState,
    sectionRef,
    hubRef,
    () => onMinimize(!dockingAll.current)
  )
  const minimizeAlone = (): void => {
    dockingAll.current = false
    minimize()
  }
  // Picked again from the hub while open: glow so the eye finds it; with motion reduced, a
  // still ring for the same while.
  const highlight = useAgentHubMirrorHighlight()
  const seenHighlight = useRef(highlight.seq)
  const [highlighted, setHighlighted] = useState(false)
  useEffect(() => {
    if (highlight.seq === seenHighlight.current || highlight.key !== mirrorKey) {
      return undefined
    }
    seenHighlight.current = highlight.seq
    minimizing.current = false
    if (!reducedMotion && sectionRef.current) {
      pulseMirrorWindow(sectionRef.current)
      return undefined
    }
    setHighlighted(true)
    const timer = setTimeout(() => setHighlighted(false), HIGHLIGHT_RING_MS)
    return () => clearTimeout(timer)
  }, [highlight, mirrorKey, sectionRef, minimizing, reducedMotion])
  // "Send all to the hub" reaches every open window, the front one first; a hub row asks one.
  const dockRequest = useAgentHubMirrorsDockRequest()
  const seenDockRequest = useRef(dockRequest.seq)
  const dockWhenAsked = useEffectEvent(() => {
    if (dockRequest.key === null) {
      dockingAll.current = true
      minimize(Math.max(0, 4 - stackIndex) * 45)
    } else if (dockRequest.key === mirrorKey) {
      minimizeAlone()
    }
  })
  useEffect(() => {
    if (dockRequest.seq !== seenDockRequest.current) {
      seenDockRequest.current = dockRequest.seq
      dockWhenAsked()
    }
  }, [dockRequest])
  const homeTitle = useAgentHubTargetTitle(target)
  const isChat = useAppStore((s) => isAgentHubChatTab(s, shownTarget.tab.id))
  const activeKind = thread ? agentHubIndicatorKind(thread) : 'idle'
  const kind = windowKind ?? activeKind
  useAgentHubMirrorSelectionFocus({
    windowId,
    tabId: windowState?.activeTabId ?? '',
    target: shownTarget,
    rootRef: sectionRef,
    // A chat claims focus through its own composer (see agent-hub-chat-destinations).
    allowed: previewFocus && surface !== 'in-workspace' && surface !== 'chat',
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
  }, [ptyId, shownTarget.tab.id, shownTarget.paneKey])

  return (
    <section
      ref={sectionRef}
      role="dialog"
      aria-label={target.title}
      data-agent-hub-mirror
      data-agent-hub-mirror-key={mirrorKey}
      data-settling={settling}
      data-focus={focus ?? undefined}
      data-highlighted={highlighted}
      data-leaving={leaving}
      data-restored={restored}
      data-kind={kind}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      // Why the strong edge: the mirror floats over terminals that share its background.
      // Why transition-none: duration-150 would also transition the box under the glide's transform.
      className="group/mirror pointer-events-auto fixed flex animate-in flex-col overflow-hidden rounded-xl border border-foreground/25 bg-background shadow-floating transition-none data-[highlighted=true]:ring-2 data-[highlighted=true]:ring-ring data-[kind=ask]:border-agent-question/60 data-[kind=done]:border-status-success/50 duration-150 fade-in-0 zoom-in-95 data-[leaving=true]:animate-out data-[leaving=true]:fade-out-0 data-[leaving=true]:zoom-out-95 data-[leaving=true]:[animation-fill-mode:forwards] data-[restored=true]:data-[leaving=false]:animate-none motion-reduce:animate-none!"
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
        data-agent-hub-mirror-header={windowId}
        // Why tinted: a mirror whose agent asks or just finished should read so at a glance.
        className="flex h-10.5 shrink-0 cursor-grab items-center gap-2.5 border-b border-border bg-popover pr-1.5 pl-3 transition-colors select-none active:cursor-grabbing group-data-[kind=ask]/mirror:border-agent-question/40 group-data-[kind=ask]/mirror:bg-agent-question/15 group-data-[kind=done]/mirror:border-status-success/35 group-data-[kind=done]/mirror:bg-status-success/12"
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
      >
        {tabStrip}
        <div aria-hidden className="min-w-4 flex-1 self-stretch" />
        <AgentHubMirrorHeaderControls
          target={shownTarget}
          reachable={surface !== 'preview'}
          mirrorKey={mirrorKey}
          focused={focus === 'focused'}
          showJump={(windowState?.tabs.length ?? 1) === 1}
          onReveal={onReveal}
          onMinimize={minimizeAlone}
          onClose={() => leave(onClose)}
          isAgent={thread !== null || target.agentType !== null}
          isChat={isChat}
          onCloseAgent={
            (windowState?.tabs.length ?? 1) === 1
              ? () =>
                  closeAgentHubAgent(
                    { ...target, agentType: thread?.agentType ?? target.agentType },
                    activeKind
                  )
              : undefined
          }
        />
      </header>
      <div
        role="tabpanel"
        id={agentHubMirrorPanelId(windowId)}
        aria-labelledby={windowState ? agentHubMirrorTabId(windowState.activeTabId) : undefined}
        className="relative flex min-h-0 flex-1 flex-col"
      >
        {surface === 'preview' || surface === 'in-workspace' ? (
          <AgentHubPaneSleepOverlay target={shownTarget} />
        ) : null}
        {family && familyBarShown ? (
          <AgentHubMirrorFamilyTabs
            family={family}
            activeKey={shownTarget.paneKey ?? thread?.paneKey ?? mirrorKey}
            home={onReturnHome ? { title: homeTitle, onSelect: onReturnHome } : undefined}
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
            <p className="max-w-85 text-xs text-muted-foreground">
              {translate(
                'agentHub.mirror.inWorkspace',
                'This pane is on screen in your current workspace, so it stays there. It moves back into this window when you switch to another tab or workspace.'
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={minimizeAlone}
              className="mt-1"
            >
              {translate('agentHub.mirror.minimize', 'Minimize')}
            </Button>
          </div>
        ) : surface === 'chat' ? (
          <div
            key="chat"
            ref={slotRef}
            data-agent-hub-mirror-slot
            className="relative flex min-h-0 flex-1 overflow-hidden"
          />
        ) : surface !== 'preview' ? (
          // The real pane renders in here (see AgentHubMirrors); it fits and resizes like any pane.
          <div ref={slotRef} data-agent-hub-mirror-slot className="relative min-h-0 flex-1">
            <AgentHubMirrorDictationOverlay target={shownTarget} showsTerminal />
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
