import { useAgentHubGroupLabels } from './use-agent-hub-group-labels'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { AGENT_HUB_ORB_VOICE_COMMANDS } from './agent-hub-orb-voice-commands'
import { AgentHubPaneSleepConfirmationHost } from './AgentHubPaneSleepConfirmation'
import { useAgentHubOrbAwareness } from './use-agent-hub-orb-awareness'
import { useNow } from '@/lib/window-activity/use-now'
import { AgentHubShortcut } from './AgentHubShortcut'
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover'
import { AgentHubShortcutsDialog } from './AgentHubShortcutsDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAgentPaneThreads } from '../activity/threads/use-agent-pane-threads'
import { activateWorkspacePaneTarget } from '../activity/thread-list/activity-thread-actions'
import { AgentHubRootAlerts } from './AgentHubRootAlerts'
import { AgentHubAnswerQueue } from './AgentHubAnswerQueue'
import { AgentHubCanvas } from './AgentHubCanvas'
import { AgentHubDock } from './AgentHubDock'
import { AgentHubDimBackdrop } from './AgentHubDimToggle'
import { AgentHubPeek } from './AgentHubPeek'
import { AgentHubWorkspaceFocusShade } from './AgentHubMirrorFocusShade'
import { AgentHubDictationPaneTag } from './AgentHubDictationPaneTag'
import { useAgentHubFocusedPaneOutline } from './use-agent-hub-focused-pane-outline'
import { AgentHubMirrors } from './AgentHubMirrors'
import type { AgentHubOpenRequest } from './AgentHubPanel'
import { AgentHubPopoverContent, type AgentHubPopoverRequest } from './AgentHubPopover'
import { AgentHubStatusTrigger } from './AgentHubStatusTrigger'
import { clearAgentHubAlerts, useAgentHubAlertQueue } from './agent-hub-alert-queue'
import { agentHubAlertsOutsideMirrors } from './agent-hub-alert-target'
import {
  agentHubInboxRequests,
  agentHubRequestKey,
  readAgentHubRequests
} from './agent-hub-requests-store'
import { agentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import { closeAgentHubCanvas, toggleAgentHubCanvas } from './agent-hub-canvas-store'
import { useAgentHubMirrorCommands } from './use-agent-hub-mirror-commands'
import { agentHubDockPopoverSide, agentHubTrayAlertSide } from './agent-hub-dock-geometry'
import type { AgentHubTab } from './agent-hub-keys'
import { agentHubInitialTab } from './agent-hub-initial-tab'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { agentHubThreadCardKey, showAgentHubCardsAgain } from './agent-hub-answered-cards'
import {
  arrangeAgentHubFloatingWindowsByDefault,
  openAgentHubMirrorInLayout
} from './agent-hub-floating-arrangement'
import { openAgentHubMirrors, useAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubTargetKind, toggleAgentHubMirrors } from './agent-hub-mirror-tray'
import {
  agentHubLocation,
  threadOpenRequest,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'
import { useAgentHubAlerts } from './use-agent-hub-alerts'
import { useAgentHubCanvas } from './use-agent-hub-canvas'
import { useAgentHubHostLabels } from './use-agent-hub-host-labels'
import { useAgentHubCanvasWelcome } from './use-agent-hub-canvas-welcome'
import { useAgentHubLists } from './use-agent-hub-lists'
import { useAgentHubSessionRestore } from './use-agent-hub-session-restore'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import { useAgentHubOrbSurfaces } from './AgentHubOrbSurfaces'
import { closeAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { useAgentHubOrbPanelExclusion } from './agent-hub-orb-panel-exclusion'

export function AgentHubRoot({ iconOnly }: { iconOnly: boolean }): React.JSX.Element {
  const preferences = useAgentHubPreferences()
  const anchorRef = useRef<HTMLElement>(null)
  const inSettings = useAppStore((s) => s.activeView === 'settings')
  const docked = preferences.placement === 'dock'
  const side = docked ? agentHubDockPopoverSide(preferences.dockPosition.edge) : 'top'
  const now = useNow(60_000)
  // Worker agents too: the hub nests them under the agent that dispatched them.
  const { allThreads: threads } = useAgentPaneThreads({
    query: '',
    readFilter: 'all',
    groupBy: 'none',
    selectedPaneKey: null,
    showChildAgents: true
  })
  const lineage = useMemo(() => buildAgentHubLineage(threads, now), [threads, now])
  const finishedMaxAgeMs = preferences.finishedClearMinutes * 60_000
  const lists = useAgentHubLists(threads, now, finishedMaxAgeMs, lineage)
  useAgentHubOrbAwareness(threads, lists)
  const orb = useAgentHubOrbSurfaces(threads, lists, anchorRef, preferences, inSettings)
  const { ownsRequest } = orb
  useAgentHubAlerts(orb.hubLists, preferences)
  useAgentHubSessionRestore(preferences.restoreOnLaunch, preferences.canvas)
  const alerts = useAgentHubAlertQueue()
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const updateSettings = useAppStore((s) => s.updateSettings)
  useAgentHubFocusedPaneOutline(preferences.focusedPaneOutline && !inSettings)
  const groupNameById = useAgentHubGroupLabels()
  const hostLabels = useAgentHubHostLabels()
  const locationOf = (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>): AgentHubLocation =>
    agentHubLocation(target, groupNameById, hostLabels)
  const requestPresentationOf = (host: string, request: AgentHubRequestBase) =>
    agentHubRequestPresentation(useAppStore.getState(), threads, host, request, locationOf)
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<AgentHubPopoverRequest>({
    tab: 'inbox',
    paneKey: null,
    seq: 0
  })
  const panelRootRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const threadsRef = useRef(threads)
  useEffect(() => {
    threadsRef.current = threads
  }, [threads])
  const toggleMirrors = useCallback(
    () =>
      toggleAgentHubMirrors(
        (target) => agentHubTargetKind(threadsRef.current, target),
        arrangeAgentHubFloatingWindowsByDefault
      ),
    []
  )
  // Why: Radix hands focus back to the trigger on close; a terminal user expects their pane back.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  const defaultTabRef = useRef<AgentHubTab>(
    agentHubInitialTab(preferences.defaultTab, orb.counts.needsYou)
  )
  const shownTabRef = useRef<AgentHubTab>('inbox')
  const needsYouRef = useRef(orb.hubLists.needsYou)
  useEffect(() => {
    needsYouRef.current = orb.hubLists.needsYou
    defaultTabRef.current = agentHubInitialTab(preferences.defaultTab, orb.counts.needsYou)
  }, [orb.hubLists.needsYou, orb.counts.needsYou, preferences.defaultTab])

  const openHub = useCallback((tab?: AgentHubTab, paneKey: string | null = null) => {
    closeAgentHubOrbPanel()
    if (!openRef.current) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    clearAgentHubAlerts()
    // Why: opened on a card from its alert, a card hidden earlier is wanted again.
    const asked = paneKey ? needsYouRef.current.find((t) => t.paneKey === paneKey) : undefined
    if (asked) {
      showAgentHubCardsAgain([agentHubThreadCardKey(asked)], 'inbox')
    }
    shownTabRef.current = tab ?? defaultTabRef.current
    setRequest((current) => ({ tab: tab ?? defaultTabRef.current, paneKey, seq: current.seq + 1 }))
    setOpen(true)
  }, [])
  const openHubTab = useAgentHubOrbPanelExclusion({
    restoreFocusRef,
    openRef,
    shownTabRef,
    setOpen,
    openHub
  })
  const setPopoverOpen = useCallback(
    (next: boolean) => (next ? openHub() : setOpen(false)),
    [openHub]
  )
  // A jump or an opened mirror focuses its own target, so nothing is restored.
  const closeForNavigation = useCallback(() => {
    restoreFocusRef.current = null
    setOpen(false)
  }, [])

  const jump = useCallback(
    ({ target, thread }: AgentHubOpenRequest) => {
      closeForNavigation()
      // The terminal is in its workspace, behind the canvas.
      closeAgentHubCanvas()
      activateWorkspacePaneTarget(
        {
          worktree: target.worktree,
          repo: target.repo,
          tabId: target.tab.id,
          paneKey: target.paneKey
        },
        { revealInSidebar: true }
      )
      if (thread) {
        acknowledgeAgents([thread.paneKey])
      }
    },
    [acknowledgeAgents, closeForNavigation]
  )
  // Keeps the hub open, so several mirrors can be popped out in a row.
  const popout = useCallback(
    ({ target, thread }: AgentHubOpenRequest) => {
      restoreFocusRef.current = null
      openAgentHubMirrorInLayout(target)
      if (thread) {
        acknowledgeAgents([thread.paneKey])
      }
    },
    [acknowledgeAgents]
  )
  const openMirror = useCallback(
    (request: AgentHubOpenRequest) => {
      closeForNavigation()
      popout(request)
    },
    [closeForNavigation, popout]
  )
  // All at once, in the default layout; the hub closes, since the grid fills the work area.
  const popoutAll = useCallback(
    (requests: AgentHubOpenRequest[]) => {
      closeForNavigation()
      openAgentHubMirrors(requests.map((request) => request.target))
      arrangeAgentHubFloatingWindowsByDefault()
    },
    [closeForNavigation]
  )
  const jumpToNextWaiting = useCallback(() => {
    const next = needsYouRef.current[0]
    if (!next) {
      const request = agentHubInboxRequests(readAgentHubRequests()).find(
        (item) => !ownsRequest(item)
      )
      if (request) {
        openHub('inbox', agentHubRequestKey(request.host, request.request.requestId))
        return
      }
      toast(translate('agentHub.toast.nobodyWaiting', 'Nobody is waiting on you'))
      return
    }
    jump(threadOpenRequest(next))
  }, [jump, openHub, ownsRequest])

  // An open or minimized mirror raises its own pane's alerts; the hub's bubble takes the rest.
  const { windows, chips } = useAgentHubMirrors()
  const mirrorsOpen = windows.length > 0
  useAgentHubMirrorCommands(
    {
      toggle: () => (openRef.current ? setOpen(false) : openHub()),
      toggleOrb: orb.toggle,
      ...AGENT_HUB_ORB_VOICE_COMMANDS,
      jumpToNextWaiting,
      toggleMirrors,
      toggleCanvas: preferences.canvas ? toggleAgentHubCanvas : null,
      arrangeMirrors: mirrorsOpen ? arrangeAgentHubFloatingWindowsByDefault : null
    },
    (target) => jump({ target, thread: null })
  )

  const muted = (preferences.alertsMutedUntil ?? 0) > now
  const canvasOpen = useAgentHubCanvas(preferences.canvas) && !inSettings
  const centred = useAgentHubCanvasWelcome({
    canvasOpen,
    empty: !mirrorsOpen,
    hubOpen: open,
    anchorRef,
    side,
    openAgents: () => openHub('agents'),
    closeHub: () => setOpen(false)
  })
  const hubAlerts = agentHubAlertsOutsideMirrors(alerts, { windows, chips })
  // Settings is its own page; the hub and its floating windows stay out of it.
  const dockHidden =
    inSettings ||
    (preferences.dockAutoHide &&
      !(open || orb.panelOpen) &&
      !canvasOpen &&
      !orb.pillVisible &&
      hubAlerts.length === 0 &&
      chips.length === 0 &&
      orb.counts.needsYou + orb.counts.working + orb.counts.finished === 0)

  const content = (
    <AgentHubPopoverContent
      side={side}
      docked={docked}
      centred={centred}
      anchorRef={anchorRef}
      restoreFocusRef={restoreFocusRef}
      lists={lists}
      lineage={lineage}
      threads={threads}
      includeShells={preferences.showShells}
      request={request}
      rootRef={panelRootRef}
      locationOf={locationOf}
      requestPresentationOf={requestPresentationOf}
      onTabChange={(tab) => {
        shownTabRef.current = tab
      }}
      onJump={jump}
      onOpen={openMirror}
      onPopout={popout}
      onPopoutAll={popoutAll}
      onClose={() => setPopoverOpen(false)}
    />
  )

  return (
    <>
      <AgentHubPaneSleepConfirmationHost />
      <AgentHubShortcutsDialog />
      <AgentHubAnswerQueue
        threads={threads}
        locationOf={locationOf}
        requestPresentationOf={requestPresentationOf}
        onJump={jump}
      />
      {docked && !inSettings ? orb.statusButton : null}
      <Popover open={open && !orb.panelOpen && !inSettings} onOpenChange={setPopoverOpen}>
        {docked ? (
          dockHidden ? null : (
            createPortal(
              <PopoverAnchor asChild>
                <AgentHubDock
                  ref={(node: HTMLDivElement | null) => {
                    anchorRef.current = node
                  }}
                  position={preferences.dockPosition}
                  size={preferences.dockSize}
                  counts={orb.counts}
                  muted={muted}
                  onOpenTab={openHubTab}
                  onNextWaiting={jumpToNextWaiting}
                  pinned={open || orb.panelOpen}
                  mirrors={{ windows: windows.length, chips: chips.length }}
                  flushTop={canvasOpen}
                  canvas={
                    preferences.canvas ? { open: canvasOpen, onToggle: toggleAgentHubCanvas } : null
                  }
                  terminals={{
                    threads,
                    includeShells: preferences.showShells,
                    parentOf: lineage.parentOf
                  }}
                  onToggleMirrors={toggleMirrors}
                  onMove={(position) => void updateSettings({ agentHubDockPosition: position })}
                  orb={orb.dockButton}
                />
              </PopoverAnchor>,
              document.body
            )
          )
        ) : inSettings ? null : (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <AgentHubStatusTrigger
                  ref={(node: HTMLButtonElement | null) => {
                    anchorRef.current = node
                  }}
                  counts={orb.counts}
                  label={orb.label}
                  open={open}
                  iconOnly={iconOnly}
                  orb={orb.statusButton}
                />
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="flex items-center gap-2">
                {translate('agentHub.title', 'Agents')}
                <AgentHubShortcut actionId="agentHub.toggle" />
              </span>
            </TooltipContent>
          </Tooltip>
        )}
        {content}
      </Popover>
      {orb.floatingButton}
      {orb.panel(requestPresentationOf)}
      {hubAlerts.length > 0 && !orb.pillVisible && !open && !inSettings ? (
        <AgentHubRootAlerts
          alerts={hubAlerts}
          anchorRef={chips.length > 0 ? trayRef : anchorRef}
          side={side}
          locationOf={locationOf}
          requestPresentationOf={requestPresentationOf}
          onOpenCard={(key) => openHub('inbox', key)}
          onOpenMirror={openMirror}
          onJump={jump}
        />
      ) : null}
      {/* The canvas hides the workspace, so there is nothing behind the mirrors to dim. */}
      <AgentHubDimBackdrop hidden={inSettings || canvasOpen} />
      {canvasOpen ? (
        <AgentHubCanvas empty={!mirrorsOpen} onLeave={closeAgentHubCanvas} />
      ) : inSettings ? null : (
        <AgentHubWorkspaceFocusShade />
      )}
      <AgentHubMirrors
        hubRef={anchorRef}
        trayRef={trayRef}
        traySide={side}
        trayAlertSide={agentHubTrayAlertSide(docked ? preferences.dockPosition : null)}
        trayHidden={open || orb.pillVisible}
        trayAlertsHidden={orb.pillVisible}
        hubOpen={open}
        trayPeekMs={preferences.trayPeekSeconds * 1000}
        hidden={inSettings}
        onCanvas={canvasOpen}
        threads={threads}
        lineage={lineage}
        alerts={alerts}
        locationOf={locationOf}
        requestPresentationOf={requestPresentationOf}
        onReveal={(target, thread) => jump({ target, thread })}
        onOpenCard={(paneKey) => openHub('inbox', paneKey)}
      />
      {orb.pill}
      {inSettings ? null : <AgentHubPeek />}
      <AgentHubDictationPaneTag />
    </>
  )
}
