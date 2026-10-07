import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useNow } from '@/hooks/use-now'
import { AgentHubShortcut } from './AgentHubShortcut'
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover'
import { AgentHubShortcutsDialog } from './AgentHubShortcutsDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAgentPaneThreads } from '../activity/use-agent-pane-threads'
import { activateWorkspacePaneTarget } from '../activity/activity-thread-actions'
import { AgentHubAlertStack } from './AgentHubAlertStack'
import { AgentHubCanvas } from './AgentHubCanvas'
import { AgentHubDock } from './AgentHubDock'
import { AgentHubDimBackdrop } from './AgentHubDimToggle'
import { AgentHubMirrors } from './AgentHubMirrors'
import type { AgentHubOpenRequest } from './AgentHubPanel'
import { AgentHubPopoverContent, type AgentHubPopoverRequest } from './AgentHubPopover'
import { AgentHubStatusTrigger } from './AgentHubStatusTrigger'
import {
  clearAgentHubAlerts,
  dismissAgentHubAlert,
  useAgentHubAlertQueue
} from './agent-hub-alert-queue'
import type { AgentHubAlert } from './agent-hub-alerts'
import { closeAgentHubCanvas, toggleAgentHubCanvas } from './agent-hub-canvas-store'
import { useAgentHubMirrorCommands } from './use-agent-hub-mirror-commands'
import { agentHubDockPopoverSide, agentHubTrayAlertSide } from './agent-hub-dock-geometry'
import type { AgentHubTab } from './agent-hub-keys'
import { agentHubInitialTab } from './agent-hub-initial-tab'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { agentHubCounts } from './agent-hub-lists'
import { arrangeAgentHubFloatingWindowsByDefault } from './agent-hub-floating-arrangement'
import {
  openAgentHubMirror,
  openAgentHubMirrors,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import { agentHubTargetKind, toggleAgentHubMirrors } from './agent-hub-mirror-tray'
import {
  agentHubLocation,
  agentHubTargetShowsThread,
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

function useGroupNameById(): ReadonlyMap<string, string> {
  const projectGroups = useAppStore((s) => s.projectGroups)
  return useMemo(
    () => new Map(projectGroups.map((group) => [group.id, group.name])),
    [projectGroups]
  )
}

/** The Agent Hub: counts, popover, live mirror, alerts and shortcuts, on a dock or the status bar. */
export function AgentHubRoot({ iconOnly }: { iconOnly: boolean }): React.JSX.Element {
  const preferences = useAgentHubPreferences()
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
  const counts = agentHubCounts(lists)
  useAgentHubAlerts(lists, preferences)
  useAgentHubSessionRestore(preferences.restoreOnLaunch, preferences.canvas)
  const alerts = useAgentHubAlertQueue()
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const inSettings = useAppStore((s) => s.activeView === 'settings')
  const groupNameById = useGroupNameById()
  const hostLabels = useAgentHubHostLabels()
  const locationOf = (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>): AgentHubLocation =>
    agentHubLocation(target, groupNameById, hostLabels)
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<AgentHubPopoverRequest>({
    tab: 'inbox',
    paneKey: null,
    seq: 0
  })
  const panelRootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement>(null)
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
    agentHubInitialTab(preferences.defaultTab, lists.needsYou.length)
  )
  const shownTabRef = useRef<AgentHubTab>('inbox')
  const needsYouRef = useRef(lists.needsYou)
  useEffect(() => {
    needsYouRef.current = lists.needsYou
    defaultTabRef.current = agentHubInitialTab(preferences.defaultTab, lists.needsYou.length)
  }, [lists.needsYou, preferences.defaultTab])

  const openHub = useCallback((tab?: AgentHubTab, paneKey: string | null = null) => {
    if (!openRef.current) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    clearAgentHubAlerts()
    shownTabRef.current = tab ?? defaultTabRef.current
    setRequest((current) => ({ tab: tab ?? defaultTabRef.current, paneKey, seq: current.seq + 1 }))
    setOpen(true)
  }, [])
  // A dock button for the tab already on show closes the hub, like a toggle.
  const openHubTab = useCallback(
    (tab: AgentHubTab) => {
      if (openRef.current && shownTabRef.current === tab) {
        setOpen(false)
        return
      }
      openHub(tab)
    },
    [openHub]
  )
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
      openAgentHubMirror(target)
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
  const leaveAlertFor = (shown: AgentHubAlert, open: typeof jump): void => {
    dismissAgentHubAlert(shown.id)
    open(threadOpenRequest(shown.thread))
  }
  const jumpToNextWaiting = useCallback(() => {
    const next = needsYouRef.current[0]
    if (!next) {
      toast(translate('agentHub.toast.nobodyWaiting', 'Nobody is waiting on you'))
      return
    }
    jump(threadOpenRequest(next))
  }, [jump])

  // An open or minimized mirror raises its own pane's alerts; the hub's bubble takes the rest.
  const { windows, chips } = useAgentHubMirrors()
  const mirrorsOpen = windows.length > 0
  useAgentHubMirrorCommands(
    {
      toggle: () => (openRef.current ? setOpen(false) : openHub()),
      jumpToNextWaiting,
      toggleMirrors,
      toggleCanvas: preferences.canvas ? toggleAgentHubCanvas : null,
      arrangeMirrors: mirrorsOpen ? arrangeAgentHubFloatingWindowsByDefault : null
    },
    (target) => jump({ target, thread: null })
  )

  const label =
    counts.needsYou === 1
      ? translate('agentHub.trigger.needsYouOne', '1 needs you')
      : counts.needsYou > 1
        ? translate('agentHub.trigger.needsYouOther', '{{value0}} need you', {
            value0: counts.needsYou
          })
        : translate('agentHub.title', 'Agents')
  const docked = preferences.placement === 'dock'
  const side = docked ? agentHubDockPopoverSide(preferences.dockPosition.edge) : 'top'
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
  const hubAlerts = alerts.filter(
    (candidate) =>
      !chips.some((chip) =>
        chip.window.tabs.some((tab) => agentHubTargetShowsThread(tab.target, candidate.thread))
      ) &&
      !windows.some((window) =>
        agentHubTargetShowsThread(activeAgentHubMirrorTab(window).target, candidate.thread)
      )
  )
  // Settings is its own page; the hub and its floating windows stay out of it.
  const dockHidden =
    inSettings ||
    (preferences.dockAutoHide &&
      !open &&
      !canvasOpen &&
      hubAlerts.length === 0 &&
      chips.length === 0 &&
      counts.needsYou + counts.working + counts.finished === 0)

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
      <AgentHubShortcutsDialog />
      <Popover open={open && !inSettings} onOpenChange={setPopoverOpen}>
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
                  counts={counts}
                  muted={muted}
                  onOpenTab={openHubTab}
                  onNextWaiting={jumpToNextWaiting}
                  pinned={open}
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
                  counts={counts}
                  label={label}
                  open={open}
                  iconOnly={iconOnly}
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
      {hubAlerts.length > 0 && !open && !inSettings ? (
        <AgentHubAlertStack
          alerts={hubAlerts}
          // With mirrors parked beside the hub, its alerts stack beyond them.
          anchorRef={chips.length > 0 ? trayRef : anchorRef}
          side={side}
          locationOf={(shown) => locationOf(shown.thread)}
          // A result is read in its terminal, so it opens the mirror; a question opens its card.
          onOpen={(opened) => {
            if (opened.kind !== 'done') {
              openHub('inbox', opened.thread.paneKey)
              return
            }
            leaveAlertFor(opened, openMirror)
          }}
          onPopout={(shown) => leaveAlertFor(shown, openMirror)}
          onJump={(shown) => leaveAlertFor(shown, jump)}
          onDismiss={dismissAgentHubAlert}
        />
      ) : null}
      {/* The canvas hides the workspace, so there is nothing behind the mirrors to dim. */}
      <AgentHubDimBackdrop hidden={inSettings || canvasOpen} />
      {canvasOpen ? <AgentHubCanvas empty={!mirrorsOpen} onLeave={closeAgentHubCanvas} /> : null}
      <AgentHubMirrors
        hubRef={anchorRef}
        trayRef={trayRef}
        traySide={side}
        trayAlertSide={agentHubTrayAlertSide(docked ? preferences.dockPosition : null)}
        trayHidden={open}
        hubOpen={open}
        trayPeekMs={preferences.trayPeekSeconds * 1000}
        hidden={inSettings}
        onCanvas={canvasOpen}
        threads={threads}
        lineage={lineage}
        alerts={alerts}
        locationOf={locationOf}
        onReveal={(target, thread) => jump({ target, thread })}
        onOpenCard={(paneKey) => openHub('inbox', paneKey)}
      />
    </>
  )
}
