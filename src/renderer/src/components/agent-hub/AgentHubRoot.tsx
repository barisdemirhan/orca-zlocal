import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useNow } from '@/hooks/use-now'
import { formatOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import {
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../status-bar/status-bar-context-menu-policy'
import { useAgentPaneThreads } from '../activity/use-agent-pane-threads'
import { activateWorkspacePaneTarget } from '../activity/activity-thread-actions'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubAlertStack } from './AgentHubAlertStack'
import { AgentHubDock } from './AgentHubDock'
import { AgentHubDimBackdrop } from './AgentHubDimToggle'
import { AgentHubMirrors } from './AgentHubMirrors'
import { AgentHubPanel, type AgentHubOpenRequest } from './AgentHubPanel'
import { AgentHubStatusTrigger } from './AgentHubStatusTrigger'
import {
  clearAgentHubAlerts,
  dismissAgentHubAlert,
  useAgentHubAlertQueue
} from './agent-hub-alert-queue'
import { registerAgentHubCommands } from './agent-hub-commands'
import { agentHubDockPopoverSide, agentHubTrayAlertSide } from './agent-hub-dock-geometry'
import type { AgentHubTab } from './agent-hub-keys'
import { buildAgentHubLineage, type AgentHubLineage } from './agent-hub-lineage'
import { agentHubCounts, type AgentHubLists } from './agent-hub-lists'
import { openAgentHubMirror, useAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubTargetKind, toggleAgentHubMirrors } from './agent-hub-mirror-tray'
import {
  agentHubLocation,
  agentHubTargetShowsThread,
  threadOpenRequest
} from './agent-hub-pane-target'
import { useAgentHubAlerts } from './use-agent-hub-alerts'
import { useAgentHubLists } from './use-agent-hub-lists'
import { useAgentHubPreferences } from './use-agent-hub-settings'
import { AgentHubTerminalCount } from './AgentHubTerminalCount'
import { useAgentHubTerminalTree } from './use-agent-hub-terminal-tree'

type OpenRequest = { tab: AgentHubTab; paneKey: string | null; seq: number }

function useGroupNameById(): ReadonlyMap<string, string> {
  const projectGroups = useAppStore((s) => s.projectGroups)
  return useMemo(
    () => new Map(projectGroups.map((group) => [group.id, group.name])),
    [projectGroups]
  )
}

/** Mounted only while the popover is open: the tree subscribes to every tab write. */
function AgentHubPopoverBody({
  lists,
  lineage,
  threads,
  includeShells,
  request,
  rootRef,
  onTabChange,
  onJump,
  onPopout,
  onClose
}: {
  lists: AgentHubLists
  lineage: AgentHubLineage
  threads: readonly AgentPaneThread[]
  includeShells: boolean
  request: OpenRequest
  rootRef: React.RefObject<HTMLDivElement | null>
  onTabChange: (tab: AgentHubTab) => void
  onJump: (request: AgentHubOpenRequest) => void
  onPopout: (request: AgentHubOpenRequest) => void
  onClose: () => void
}): React.JSX.Element {
  const tree = useAgentHubTerminalTree(threads, includeShells, lineage.parentOf)
  const groupNameById = useGroupNameById()
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const terminalCount = tree.reduce((total, group) => total + group.rowCount, 0)
  return (
    <AgentHubPanel
      // Why the seq key: a dock button or alert reopens on its own tab and card.
      key={request.seq}
      lists={lists}
      lineage={lineage}
      tree={tree}
      terminalCount={terminalCount}
      locationOf={(target) => agentHubLocation(target, groupNameById)}
      rootRef={rootRef}
      onJump={onJump}
      onPopout={onPopout}
      onMarkRead={acknowledgeAgents}
      onClose={onClose}
      initialTab={request.tab}
      onTabChange={onTabChange}
      initialPaneKey={request.paneKey}
    />
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
  const alerts = useAgentHubAlertQueue()
  const acknowledgeAgents = useAppStore((s) => s.acknowledgeAgents)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const inSettings = useAppStore((s) => s.activeView === 'settings')
  const groupNameById = useGroupNameById()
  const keybindings = useAppStore((s) => s.keybindings)
  const shortcut = formatOptionalShortcutLabel('agentHub.toggle', keybindings)
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<OpenRequest>({ tab: 'inbox', paneKey: null, seq: 0 })
  const panelRootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const threadsRef = useRef(threads)
  useEffect(() => {
    threadsRef.current = threads
  }, [threads])
  const toggleMirrors = useCallback(
    () => toggleAgentHubMirrors((target) => agentHubTargetKind(threadsRef.current, target)),
    []
  )
  // Why: Radix hands focus back to the trigger on close; a terminal user expects their pane back.
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  const defaultTabRef = useRef<AgentHubTab>('inbox')
  const shownTabRef = useRef<AgentHubTab>('inbox')
  const needsYouRef = useRef(lists.needsYou)
  useEffect(() => {
    needsYouRef.current = lists.needsYou
    defaultTabRef.current = lists.needsYou.length > 0 ? 'inbox' : preferences.defaultTab
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
  // A jump or pop-out focuses its own target, so nothing is restored.
  const closeForNavigation = useCallback(() => {
    restoreFocusRef.current = null
    setOpen(false)
  }, [])

  const jump = useCallback(
    ({ target, thread }: AgentHubOpenRequest) => {
      closeForNavigation()
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
  const popout = useCallback(
    ({ target, thread }: AgentHubOpenRequest) => {
      closeForNavigation()
      openAgentHubMirror(target)
      if (thread) {
        acknowledgeAgents([thread.paneKey])
      }
    },
    [acknowledgeAgents, closeForNavigation]
  )
  const jumpToNextWaiting = useCallback(() => {
    const next = needsYouRef.current[0]
    if (!next) {
      toast(translate('agentHub.toast.nobodyWaiting', 'Nobody is waiting on you'))
      return
    }
    jump(threadOpenRequest(next))
  }, [jump])

  useEffect(
    () =>
      registerAgentHubCommands({
        toggle: () => (openRef.current ? setOpen(false) : openHub()),
        jumpToNextWaiting,
        toggleMirrors
      }),
    [jumpToNextWaiting, openHub, toggleMirrors]
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
  // An open or minimized mirror raises its own pane's alerts; the hub's bubble takes the rest.
  const { windows, chips } = useAgentHubMirrors()
  const hubAlerts = alerts.filter(
    (candidate) =>
      !chips.some((chip) => agentHubTargetShowsThread(chip.target, candidate.thread)) &&
      !windows.some((open) => agentHubTargetShowsThread(open, candidate.thread))
  )
  // Settings is its own page; the hub and its floating windows stay out of it.
  const dockHidden =
    inSettings ||
    (preferences.dockAutoHide &&
      !open &&
      hubAlerts.length === 0 &&
      chips.length === 0 &&
      counts.needsYou + counts.working + counts.finished === 0)

  const content = (
    <PopoverContent
      side={side}
      align={docked ? 'center' : 'end'}
      sideOffset={docked ? 12 : 8}
      {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
      collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
      surface="panel"
      className="w-[456px] max-w-[calc(100vw-2rem)]"
      data-agent-hub-panel
      onOpenAutoFocus={(event) => {
        // Why: the panel root owns the arrow/number keys, so it takes focus, not the first button.
        event.preventDefault()
        panelRootRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        const previous = restoreFocusRef.current
        restoreFocusRef.current = null
        if (previous?.isConnected) {
          previous.focus()
        }
      }}
      onInteractOutside={(event) => {
        // Why: the dock's own buttons switch tabs; treating them as "outside" would close first.
        if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
          event.preventDefault()
        }
      }}
      onEscapeKeyDown={(event) => {
        // Why: Esc in a non-empty filter clears it (see AgentHubTerminalTree) instead of closing.
        const active = document.activeElement
        if (
          active instanceof HTMLInputElement &&
          active.dataset.agentHubSearch !== undefined &&
          active.value
        ) {
          event.preventDefault()
        }
      }}
    >
      <AgentHubPopoverBody
        lists={lists}
        lineage={lineage}
        threads={threads}
        includeShells={preferences.showShells}
        request={request}
        rootRef={panelRootRef}
        onTabChange={(tab) => {
          shownTabRef.current = tab
        }}
        onJump={jump}
        onPopout={popout}
        onClose={() => setPopoverOpen(false)}
      />
      <PopoverArrow width={14} height={7} />
    </PopoverContent>
  )

  return (
    <>
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
                  terminalCount={
                    <AgentHubTerminalCount
                      threads={threads}
                      includeShells={preferences.showShells}
                      parentOf={lineage.parentOf}
                    />
                  }
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
              {translate('agentHub.title', 'Agents')}
              {shortcut ? ` (${shortcut})` : null}
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
          locationOf={(shown) => agentHubLocation(shown.thread, groupNameById)}
          // A result is read in its terminal, so it opens the mirror; a question opens its card.
          onOpen={(opened) => {
            if (opened.kind !== 'done') {
              openHub('inbox', opened.thread.paneKey)
              return
            }
            dismissAgentHubAlert(opened.id)
            popout(threadOpenRequest(opened.thread))
          }}
          onPopout={(shown) => {
            dismissAgentHubAlert(shown.id)
            popout(threadOpenRequest(shown.thread))
          }}
          onJump={(shown) => {
            dismissAgentHubAlert(shown.id)
            jump(threadOpenRequest(shown.thread))
          }}
          onDismiss={dismissAgentHubAlert}
        />
      ) : null}
      <AgentHubDimBackdrop hidden={inSettings} />
      <AgentHubMirrors
        hubRef={anchorRef}
        trayRef={trayRef}
        traySide={side}
        trayAlertSide={agentHubTrayAlertSide(docked ? preferences.dockPosition : null)}
        trayHidden={open}
        trayPeekMs={preferences.trayPeekSeconds * 1000}
        hidden={inSettings}
        threads={threads}
        lineage={lineage}
        alerts={alerts}
        locationOf={(target) => agentHubLocation(target, groupNameById)}
        onReveal={(target, thread) => jump({ target, thread })}
        onOpenCard={(paneKey) => openHub('inbox', paneKey)}
      />
    </>
  )
}
