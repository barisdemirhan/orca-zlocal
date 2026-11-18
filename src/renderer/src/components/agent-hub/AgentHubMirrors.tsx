import { useAgentHubCanvasSettle } from './use-mirror-canvas-settle'
import { AgentHubMirrorPreviews } from './AgentHubMirrorPreviews'
import { AgentHubMirrorTabDragLayer } from './AgentHubMirrorTabDragLayer'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { selectAgentHubMirrorFamilyMember } from './agent-hub-mirror-tab-actions'
import {
  requestAgentHubMirrorSelection,
  useAgentHubMirrorSelection
} from './agent-hub-mirror-selection'
import { activeAgentHubMirrorTab, shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { useAgentHubMirrorSurfaces } from './use-agent-hub-mirror-surfaces'
import { agentHubMirrorWindowKind } from './agent-hub-mirror-window-kind'
import { agentHubMirrorPointerSelection } from './agent-hub-mirror-pointer-selection'
import { useAgentHubMirrorFocus } from './agent-hub-mirror-focus'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import { normalizeAgentHubMirrorWindowCap } from '../../../../shared/agent-hub-settings'
import { setTerminalMirrorMountLeases } from '../terminal-pane/terminal-mount-retention-leases'
import { activityThreadRowCopy } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubAlertSide } from './AgentHubAlertStack'
import { agentHubMirrorFamilyActions } from './agent-hub-mirror-family-actions'
import {
  releaseAgentHubMirrorShownTarget,
  returnAgentHubMirrorTabHome
} from './agent-hub-mirror-viewing'
import { AgentHubMirrorTray, type AgentHubTrayItem } from './AgentHubMirrorTray'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import { dismissAgentHubAlert } from './agent-hub-alert-queue'
import { trackAgentHubDictationOrigin } from './agent-hub-dictation-origin'
import type { AgentHubAlert, AgentHubThreadAlert } from './agent-hub-alerts'
import { agentHubAlertMatchesMirrorTab } from './agent-hub-alert-target'
import { agentHubMirrorAlertTrayActions } from './agent-hub-mirror-alert-actions'
import type { AgentHubRequestBase } from '../../../../shared/agent-hub-requests'
import type { AgentHubRequestPresentation } from './agent-hub-request-presentation'
import type { AgentHubLineage } from './agent-hub-lineage'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { orderAgentHubTray } from './agent-hub-mirror-tray'
import { rearrangeAgentHubMirrorsByDefault } from './agent-hub-floating-arrangement'
import { usePruneClosedAgentHubMirrorSources } from './use-prune-closed-agent-hub-mirror-sources'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  focusAgentHubMirror,
  minimizeAgentHubMirror,
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

/**
 * Mirrors stay below the floating workspace, rising above it while a mirror is focused.
 * Inside the mirrors' layer, the window clicked last is in front.
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
  trayAlertsHidden = false,
  hubOpen,
  trayPeekMs,
  threads,
  lineage,
  alerts,
  locationOf,
  requestPresentationOf,
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
  trayAlertsHidden?: boolean
  /** The hub's panel has the keyboard: a mirror popped out from it must not take focus. */
  hubOpen: boolean
  trayPeekMs: number
  threads: readonly AgentPaneThread[]
  lineage: AgentHubLineage
  alerts: readonly AgentHubAlert[]
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  requestPresentationOf: (host: string, request: AgentHubRequestBase) => AgentHubRequestPresentation
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
  /** Opens the hub on this waiting agent's card. */
  onOpenCard: (paneKey: string) => void
}): React.JSX.Element | null {
  const { windows, chips } = useAgentHubMirrors()
  const focused = useAgentHubMirrorFocus() !== null
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
  // Mirrors put back at launch take the keyboard from nobody until the user picks one.
  const quiet = useAgentHubMirrorStageQuiet()
  const windowCap = useAppStore((s) =>
    normalizeAgentHubMirrorWindowCap(s.settings?.agentHubMirrorWindowCap)
  )
  useLayoutEffect(() => setAgentHubMirrorWindowCap(windowCap), [windowCap])
  const [slots, setSlots] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map())
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
  const surfaces = useAgentHubMirrorSurfaces({ windows, slots, onCanvas, hubOpen, quiet, hidden })
  useLayoutEffect(() => {
    setTerminalMirrorMountLeases(
      windows
        .flatMap((window) =>
          window.tabs
            .filter((tab) => visited.current.has(tab.id))
            .flatMap((tab) => (tab.viewing ? [tab.target, tab.viewing] : [tab.target]))
        )
        .filter((target) => target.worktree.id !== FLOATING_TERMINAL_WORKTREE_ID)
        .map((target) => ({ worktreeId: target.worktree.id, tabId: target.tab.id }))
    )
  }, [windows])
  useLayoutEffect(() => () => setTerminalMirrorMountLeases([]), [])
  // Each mirror's microphone needs to know which pane a dictation started in.
  useEffect(trackAgentHubDictationOrigin, [])
  usePruneClosedAgentHubMirrorSources(threads)
  useAgentHubCanvasSettle()

  if (windows.length === 0 && chips.length === 0) {
    return null
  }
  const threadFor = (target: AgentHubPaneTarget): AgentPaneThread | null =>
    threads.find((thread) => agentHubTargetShowsThread(target, thread)) ?? null
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
              chip.window.tabs.some((tab) => agentHubAlertMatchesMirrorTab(candidate, tab))
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
        data-hidden={hidden}
        data-focused={focused}
        className="pointer-events-none fixed inset-0 z-[44] data-[focused=true]:z-[47] data-[hidden=true]:invisible"
      >
        {stableWindows.map((window) => {
          const tab = activeAgentHubMirrorTab(window)
          const target = tab.target
          const shownTarget = shownAgentHubMirrorTarget(tab)
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
                <AgentHubMirrorTabStrip
                  window={window}
                  threads={threads}
                  lineage={lineage}
                  locationOf={locationOf}
                  onReveal={onReveal}
                />
              }
              windowKind={agentHubMirrorWindowKind(window, (entry) => {
                const live = threadFor(entry)
                return live ? agentHubIndicatorKind(live) : 'idle'
              })}
              target={target}
              shownTarget={shownTarget}
              thread={thread}
              stackIndex={index + 1}
              besideHubPanel={hubOpen}
              previewFocus={index === windows.length - 1 && !hubOpen && !quiet && !hidden}
              surface={surfaces[index]?.surface ?? 'portal'}
              // The window raises its own pane's alerts; the hub's bubble skips them.
              // A hidden window leaves its alert queued until it is back in sight.
              nudge={
                hidden
                  ? null
                  : (alerts.findLast(
                      (candidate): candidate is AgentHubThreadAlert =>
                        !candidate.request &&
                        agentHubTargetShowsThread(shownTarget, candidate.thread)
                    ) ?? null)
              }
              onNudged={dismissAgentHubAlert}
              // Why the thread's pane too: a mirror opened on a quiet tab has no pane of its own
              // (it follows the tab), and must still show the workers its agent dispatches later.
              family={familyKey ? agentHubMirrorFamily(familyKey, threads, lineage) : null}
              hubRef={hubRef}
              locationOf={locationOf}
              familyActionsFor={(member) =>
                agentHubMirrorFamilyActions({
                  member,
                  state: { windows, chips },
                  windowId: key,
                  onScreenTab,
                  onReveal
                })
              }
              onReturnHome={
                tab.viewing ? () => returnAgentHubMirrorTabHome(key, tab.id) : undefined
              }
              onRetarget={(member) =>
                selectAgentHubMirrorFamilyMember(
                  key,
                  window.activeTabId,
                  paneTargetFromThread(member, activityThreadRowCopy(member).taskTitle)
                )
              }
              onSlot={onSlot}
              onFocus={(event) => {
                focusAgentHubMirror(key)
                const element = event.target instanceof HTMLElement ? event.target : null
                const alreadyActive =
                  selection.windowId === key &&
                  selection.tabId === window.activeTabId &&
                  selection.focusTerminal
                const next = agentHubMirrorPointerSelection(element, alreadyActive)
                if (next) {
                  requestAgentHubMirrorSelection(key, window.activeTabId, next.focusTerminal, false)
                }
              }}
              onClose={() => {
                closeAgentHubMirror(key)
                rearrangeAgentHubMirrorsByDefault()
              }}
              onMinimize={(alone) => {
                minimizeAgentHubMirror(key)
                if (alone) {
                  rearrangeAgentHubMirrorsByDefault()
                }
              }}
              onReveal={() => {
                releaseAgentHubMirrorShownTarget(key, tab.id)
                onReveal(shownTarget, threadFor(shownTarget))
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
          alertsHidden={trayAlertsHidden}
          peekMs={trayPeekMs}
          onRestore={(id) => {
            restoreAgentHubMirror(id)
            rearrangeAgentHubMirrorsByDefault()
          }}
          {...agentHubMirrorAlertTrayActions({
            locationOf,
            requestPresentationOf,
            onReveal,
            onOpenCard
          })}
          onClose={closeAgentHubMirrorChip}
          onDismissAlert={dismissAgentHubAlert}
        />
      </div>
    </AgentHubMirrorTabDragLayer>,
    document.body
  )
}
