import { AgentHubMirrorPreviews } from './AgentHubMirrorPreviews'
import { AgentHubMirrorTabDragLayer } from './AgentHubMirrorTabDragLayer'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { selectAgentHubMirrorFamilyMember } from './agent-hub-mirror-tab-actions'
import {
  requestAgentHubMirrorSelection,
  useAgentHubMirrorSelection
} from './agent-hub-mirror-selection'
import {
  activeAgentHubMirrorTab,
  findAgentHubMirrorMembership
} from './agent-hub-mirror-membership'
import { agentHubMirrorWindowKind } from './agent-hub-mirror-window-kind'
import { closeAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { normalizeAgentHubMirrorWindowCap } from '../../../../shared/agent-hub-settings'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { useAgentHubBorrowedTabs } from './agent-hub-borrowed-tabs'
import { isTerminalSourceVisible } from '../terminal-pane/terminal-source-visibility'
import { setTerminalMirrorMountLeases } from '../terminal-pane/terminal-mount-retention-leases'
import {
  setAgentHubTerminalPortals,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubAlertSide } from './AgentHubAlertStack'
import type { AgentHubThreadCardActions } from './AgentHubThreadHoverCard'
import { AgentHubMirrorTray, type AgentHubTrayItem } from './AgentHubMirrorTray'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import { dismissAgentHubAlert } from './agent-hub-alert-queue'
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'
import type { AgentHubAlert } from './agent-hub-alerts'
import type { AgentHubLineage } from './agent-hub-lineage'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { orderAgentHubTray } from './agent-hub-mirror-tray'
import { useFloatingPanelInFront } from './use-floating-panel-in-front'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  focusAgentHubMirror,
  minimizeAgentHubMirror,
  openAgentHubMirror,
  restoreAgentHubMirror,
  setAgentHubMirrorWindowCap,
  useAgentHubMirrors,
  useAgentHubMirrorStageQuiet
} from './agent-hub-mirror-store'
import {
  agentHubTargetShowsThread,
  paneTargetFromThread,
  type AgentHubLocation,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'

type MirrorSurface = 'portal' | 'in-workspace' | 'preview'

/**
 * Every open mirror window and minimized chip, in one layer: above the floating workspace
 * panel (z-45) and below modal layers (z-50). Inside it, the window clicked last is in front.
 * Windows borrow the real terminal pane through the portal Activity uses.
 */
export function AgentHubMirrors({
  hidden,
  onCanvas,
  hubRef,
  trayRef,
  traySide,
  trayAlertSide,
  trayHidden,
  hubOpen,
  trayPeekMs,
  threads,
  lineage,
  alerts,
  locationOf,
  onReveal,
  onOpenCard
}: {
  /** Out of sight but mounted (Settings), so mirrored panes are not moved back and forth. */
  hidden: boolean
  /** The canvas is up over the workspace, so no pane counts as on screen there. */
  onCanvas: boolean
  /** The hub (dock or status-bar trigger): windows fly into it and the tray sits beside it. */
  hubRef: React.RefObject<HTMLElement | null>
  trayRef: React.RefObject<HTMLDivElement | null>
  traySide: AgentHubAlertSide
  trayAlertSide: AgentHubAlertSide
  /** The hub's own panel is open over the tray's spot. */
  trayHidden: boolean
  /** The hub's panel has the keyboard: a mirror popped out from it must not take focus. */
  hubOpen: boolean
  trayPeekMs: number
  threads: readonly AgentPaneThread[]
  lineage: AgentHubLineage
  alerts: readonly AgentHubAlert[]
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
  /** Opens the hub on this waiting agent's card. */
  onOpenCard: (paneKey: string) => void
}): React.JSX.Element | null {
  const { windows, chips } = useAgentHubMirrors()
  const selection = useAgentHubMirrorSelection()
  const visited = useRef(new Set<string>())
  for (const window of windows) {
    visited.current.add(window.activeTabId)
  }
  const present = new Set(windows.flatMap((window) => window.tabs.map((tab) => tab.id)))
  for (const id of visited.current) {
    if (!present.has(id)) {
      visited.current.delete(id)
    }
  }
  const borrowed = useAgentHubBorrowedTabs()
  // Mirrors put back at launch take the keyboard from nobody until the user picks one.
  const quiet = useAgentHubMirrorStageQuiet()
  const windowCap = useAppStore((s) =>
    normalizeAgentHubMirrorWindowCap(s.settings?.agentHubMirrorWindowCap)
  )
  useLayoutEffect(() => setAgentHubMirrorWindowCap(windowCap), [windowCap])
  const [slots, setSlots] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map())
  const panelInFront = useFloatingPanelInFront(windows.length)
  // The tab on screen in the workspace, so a family member already there offers no jump.
  const onScreenTab = useAppStore((state) =>
    !onCanvas && state.activeView === 'terminal' && state.activeWorktreeId && state.activeTabId
      ? `${state.activeWorktreeId}\u0000${state.activeTabId}`
      : null
  )
  const onSlot = useCallback((key: string, element: HTMLElement | null): void => {
    setSlots((current) => {
      if (current.get(key) === element || (!element && !current.has(key))) {
        return current
      }
      const next = new Map(current)
      if (element) {
        next.set(key, element)
      } else {
        next.delete(key)
      }
      return next
    })
  }, [])
  // The pane each window shows (a shell target follows its tab's active pane), and whether
  // that tab is on screen in the workspace right now — the pane can only be in one place.
  const placement = useAppStore(
    useShallow((state) =>
      windows.map((window) => {
        const target = activeAgentHubMirrorTab(window).target
        const leafId = state.terminalLayoutsByTabId[target.tab.id]?.activeLeafId
        const paneKey = target.paneKey ?? (leafId ? makePaneKey(target.tab.id, leafId) : null)
        const onScreen =
          !borrowed.some(
            (tab) => tab.tabId === target.tab.id && tab.worktreeId === target.worktree.id
          ) && isTerminalSourceVisible(state, target.worktree.id, target.tab.id, onCanvas)
        return `${paneKey ?? ''}\u0000${onScreen ? '1' : '0'}`
      })
    )
  )
  const surfaces = useMemo(
    () =>
      windows.map((window, index): { surface: MirrorSurface; paneKey: string | null } => {
        const target = activeAgentHubMirrorTab(window).target
        const [paneKey = '', onScreen] = (placement[index] ?? '').split('\u0000')
        if (target.worktree.id === FLOATING_TERMINAL_WORKTREE_ID) {
          // The floating panel draws its own terminals; the dashboard preview stands in.
          return { surface: 'preview', paneKey: paneKey || null }
        }
        return { surface: onScreen === '1' ? 'in-workspace' : 'portal', paneKey: paneKey || null }
      }),
    [windows, placement]
  )
  const portals = useMemo(
    () =>
      windows.flatMap((window, index): ActivityTerminalPortalTarget[] => {
        const target = activeAgentHubMirrorTab(window).target
        const key = window.id
        const slot = slots.get(key)
        const { surface, paneKey } = surfaces[index] ?? { surface: 'portal', paneKey: null }
        if (surface !== 'portal' || !slot || !paneKey) {
          return []
        }
        return [
          {
            owner: 'agent-hub',
            priority: index,
            slotId: `agent-hub:${key}`,
            requestToken: `agent-hub:${key}:${paneKey}`,
            target: slot,
            worktreeId: target.worktree.id,
            tabId: target.tab.id,
            paneKey,
            // Only the front window's pane takes keyboard focus on arrival.
            active:
              selection.windowId === window.id &&
              selection.tabId === window.activeTabId &&
              selection.focusTerminal &&
              index === windows.length - 1 &&
              !hubOpen &&
              !quiet &&
              !hidden
          }
        ]
      }),
    [windows, slots, surfaces, hubOpen, quiet, hidden, selection]
  )
  // Why layout: publish before paint so the pane moves in the same frame the window opens.
  useLayoutEffect(() => {
    setAgentHubTerminalPortals(portals)
  }, [portals])
  useLayoutEffect(() => () => setAgentHubTerminalPortals([]), [])
  useLayoutEffect(() => {
    setTerminalMirrorMountLeases(
      windows
        .flatMap((window) =>
          window.tabs.filter((tab) => visited.current.has(tab.id)).map((tab) => tab.target)
        )
        .filter((target) => target.worktree.id !== FLOATING_TERMINAL_WORKTREE_ID)
        .map((target) => ({ worktreeId: target.worktree.id, tabId: target.tab.id }))
    )
  }, [windows])
  useLayoutEffect(() => () => setTerminalMirrorMountLeases([]), [])
  // Each mirror's microphone needs to know which pane a dictation started in.
  useEffect(trackAgentHubDictationOrigin, [])

  if (windows.length === 0 && chips.length === 0) {
    return null
  }
  const threadFor = (target: AgentHubPaneTarget): AgentPaneThread | null =>
    threads.find((thread) => agentHubTargetShowsThread(target, thread)) ?? null
  const familyActionsFor = (member: AgentPaneThread): AgentHubThreadCardActions => {
    const target = paneTargetFromThread(member, activityThreadRowCopy(member).taskTitle)
    const inWindow = findAgentHubMirrorMembership({ windows, chips }, target) !== null
    const onScreen = onScreenTab === `${member.worktree.id}\u0000${member.tab.id}`
    return {
      ...(inWindow || onScreen ? {} : { onJump: () => onReveal(target, member) }),
      // Already in a window (or parked in the tray): no second one.
      ...(inWindow ? {} : { onPopout: () => openAgentHubMirror(target) })
    }
  }
  const trayItems = orderAgentHubTray(
    chips.map((chip): AgentHubTrayItem => {
      const target = activeAgentHubMirrorTab(chip.window).target
      const thread = threadFor(target)
      return {
        key: chip.window.id,
        chip,
        thread,
        kind: agentHubMirrorWindowKind(chip.window, (entry) => {
          const live = threadFor(entry)
          return live ? agentHubIndicatorKind(live) : 'idle'
        }),
        location: locationOf(target),
        alert: hidden
          ? null
          : (alerts.findLast((candidate) =>
              chip.window.tabs.some((tab) =>
                agentHubTargetShowsThread(tab.target, candidate.thread)
              )
            ) ?? null)
      }
    })
  )
  // Why a fixed DOM order: bringing a window forward only changes its z-index; moving its node
  // mid-click would drop the terminal's focus and the pointer.
  const stackIndexOf = new Map(windows.map((window, index) => [window.id, index]))
  const stableWindows = windows.toSorted((a, b) => a.id.localeCompare(b.id))

  return createPortal(
    <AgentHubMirrorTabDragLayer enabled={!hidden}>
      <div
        data-agent-hub-mirrors
        data-behind={panelInFront}
        data-hidden={hidden}
        // Why z-[44] behind: under the floating workspace (45), still over the dim (43).
        className="pointer-events-none fixed inset-0 z-[46] data-[behind=true]:z-[44] data-[hidden=true]:invisible"
      >
        {stableWindows.map((window) => {
          const target = activeAgentHubMirrorTab(window).target
          const key = window.id
          const index = stackIndexOf.get(key) ?? 0
          const thread = threadFor(target)
          const familyKey = target.paneKey ?? thread?.paneKey
          return (
            <AgentHubMirrorWindow
              key={key}
              windowId={key}
              windowState={window}
              tabStrip={
                <AgentHubMirrorTabStrip window={window} threads={threads} lineage={lineage} />
              }
              windowKind={agentHubMirrorWindowKind(window, (entry) => {
                const live = threadFor(entry)
                return live ? agentHubIndicatorKind(live) : 'idle'
              })}
              target={target}
              thread={thread}
              location={locationOf(target)}
              stackIndex={index + 1}
              besideHubPanel={hubOpen}
              previewFocus={index === windows.length - 1 && !hubOpen && !quiet && !hidden}
              surface={surfaces[index]?.surface ?? 'portal'}
              // The window raises its own pane's alerts; the hub's bubble skips them.
              // A hidden window leaves its alert queued until it is back in sight.
              nudge={
                hidden
                  ? null
                  : (alerts.findLast((candidate) =>
                      agentHubTargetShowsThread(target, candidate.thread)
                    ) ?? null)
              }
              onNudged={dismissAgentHubAlert}
              // Why the thread's pane too: a mirror opened on a quiet tab has no pane of its own
              // (it follows the tab), and must still show the workers its agent dispatches later.
              family={familyKey ? agentHubMirrorFamily(familyKey, threads, lineage) : null}
              hubRef={hubRef}
              locationOf={locationOf}
              familyActionsFor={familyActionsFor}
              onRetarget={(member) =>
                selectAgentHubMirrorFamilyMember(
                  key,
                  paneTargetFromThread(member, activityThreadRowCopy(member).taskTitle)
                )
              }
              onSlot={onSlot}
              onFocus={(event) => {
                focusAgentHubMirror(key)
                requestAgentHubMirrorSelection(
                  key,
                  window.activeTabId,
                  event.target instanceof HTMLElement && event.target.closest('.xterm') !== null,
                  false
                )
              }}
              onClose={() => closeAgentHubMirror(key)}
              onMinimize={() => minimizeAgentHubMirror(key)}
              onReveal={() => {
                closeAgentHubMirrorTab(key, window.activeTabId)
                onReveal(target, thread)
              }}
            />
          )
        })}
        <AgentHubMirrorPreviews windows={windows} slots={slots} visible={!hidden} />
        <AgentHubMirrorTray
          items={trayItems}
          trayRef={trayRef}
          anchorRef={hubRef}
          side={traySide}
          alertSide={trayAlertSide}
          hidden={trayHidden || hidden}
          peekMs={trayPeekMs}
          onRestore={restoreAgentHubMirror}
          locationOfAlert={(alert) => locationOf(alert.thread)}
          onReveal={(item, alert) => {
            const tab = alert
              ? item.chip.window.tabs.find((tab) =>
                  agentHubTargetShowsThread(tab.target, alert.thread)
                )
              : activeAgentHubMirrorTab(item.chip.window)
            if (!tab) {
              return
            }
            closeAgentHubMirrorTab(item.key, tab.id)
            onReveal(
              alert
                ? paneTargetFromThread(alert.thread, activityThreadRowCopy(alert.thread).taskTitle)
                : tab.target,
              alert?.thread ?? item.thread
            )
          }}
          onClose={closeAgentHubMirrorChip}
          onOpenAlert={(_key, opened) => {
            dismissAgentHubAlert(opened.id)
            // A question is answered on its card; a result is read in the terminal.
            if (opened.kind === 'done') {
              openAgentHubMirror(
                paneTargetFromThread(opened.thread, activityThreadRowCopy(opened.thread).taskTitle)
              )
            } else {
              onOpenCard(opened.thread.paneKey)
            }
          }}
          onDismissAlert={dismissAgentHubAlert}
        />
      </div>
    </AgentHubMirrorTabDragLayer>,
    document.body
  )
}
