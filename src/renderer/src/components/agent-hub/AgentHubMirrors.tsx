import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { normalizeAgentHubMirrorWindowCap } from '../../../../shared/agent-hub-settings'
import { makePaneKey } from '../../../../shared/stable-pane-id'
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
  retargetAgentHubMirror,
  setAgentHubMirrorWindowCap,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import {
  agentHubPaneTargetKey,
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
      windows.map((target) => {
        const leafId = state.terminalLayoutsByTabId[target.tab.id]?.activeLeafId
        const paneKey = target.paneKey ?? (leafId ? makePaneKey(target.tab.id, leafId) : null)
        const onScreen =
          !onCanvas &&
          state.activeView === 'terminal' &&
          state.activeWorktreeId === target.worktree.id &&
          state.activeTabId === target.tab.id
        return `${paneKey ?? ''}\u0000${onScreen ? '1' : '0'}`
      })
    )
  )
  const surfaces = useMemo(
    () =>
      windows.map((target, index): { surface: MirrorSurface; paneKey: string | null } => {
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
      windows.flatMap((target, index): ActivityTerminalPortalTarget[] => {
        const key = agentHubPaneTargetKey(target)
        const slot = slots.get(key)
        const { surface, paneKey } = surfaces[index] ?? { surface: 'portal', paneKey: null }
        if (surface !== 'portal' || !slot || !paneKey) {
          return []
        }
        return [
          {
            slotId: `agent-hub:${key}`,
            requestToken: `agent-hub:${key}:${paneKey}`,
            target: slot,
            worktreeId: target.worktree.id,
            tabId: target.tab.id,
            paneKey,
            // Only the front window's pane takes keyboard focus on arrival.
            active: index === windows.length - 1 && !hubOpen
          }
        ]
      }),
    [windows, slots, surfaces, hubOpen]
  )
  // Why layout: publish before paint so the pane moves in the same frame the window opens.
  useLayoutEffect(() => {
    setAgentHubTerminalPortals(portals)
  }, [portals])
  useLayoutEffect(() => () => setAgentHubTerminalPortals([]), [])
  // Each mirror's microphone needs to know which pane a dictation started in.
  useEffect(trackAgentHubDictationOrigin, [])

  if (windows.length === 0 && chips.length === 0) {
    return null
  }
  const threadFor = (target: AgentHubPaneTarget): AgentPaneThread | null =>
    threads.find((thread) => agentHubTargetShowsThread(target, thread)) ?? null
  const openKeys = new Set(
    [...windows, ...chips.map((chip) => chip.target)].map(agentHubPaneTargetKey)
  )
  const familyActionsFor = (member: AgentPaneThread): AgentHubThreadCardActions => {
    const target = paneTargetFromThread(member, activityThreadRowCopy(member).taskTitle)
    const inWindow = openKeys.has(member.paneKey)
    const onScreen = onScreenTab === `${member.worktree.id}\u0000${member.tab.id}`
    return {
      ...(inWindow || onScreen ? {} : { onJump: () => onReveal(target, member) }),
      // Already in a window (or parked in the tray): no second one.
      ...(inWindow ? {} : { onPopout: () => openAgentHubMirror(target) })
    }
  }
  const trayItems = orderAgentHubTray(
    chips.map((chip): AgentHubTrayItem => {
      const thread = threadFor(chip.target)
      return {
        key: agentHubPaneTargetKey(chip.target),
        chip,
        thread,
        kind: thread ? agentHubIndicatorKind(thread) : 'idle',
        location: locationOf(chip.target),
        alert: hidden
          ? null
          : (alerts.findLast((candidate) =>
              agentHubTargetShowsThread(chip.target, candidate.thread)
            ) ?? null)
      }
    })
  )
  // Why a fixed DOM order: bringing a window forward only changes its z-index; moving its node
  // mid-click would drop the terminal's focus and the pointer.
  const stackIndexOf = new Map(
    windows.map((target, index) => [agentHubPaneTargetKey(target), index])
  )
  const stableWindows = windows.toSorted((a, b) =>
    agentHubPaneTargetKey(a).localeCompare(agentHubPaneTargetKey(b))
  )

  return createPortal(
    <div
      data-agent-hub-mirrors
      data-behind={panelInFront}
      data-hidden={hidden}
      // Why z-[44] behind: under the floating workspace (45), still over the dim (43).
      className="pointer-events-none fixed inset-0 z-[46] data-[behind=true]:z-[44] data-[hidden=true]:invisible"
    >
      {stableWindows.map((target) => {
        const key = agentHubPaneTargetKey(target)
        const index = stackIndexOf.get(key) ?? 0
        const thread = threadFor(target)
        const familyKey = target.paneKey ?? thread?.paneKey
        return (
          <AgentHubMirrorWindow
            key={key}
            target={target}
            thread={thread}
            location={locationOf(target)}
            stackIndex={index + 1}
            besideHubPanel={hubOpen}
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
              retargetAgentHubMirror(
                key,
                paneTargetFromThread(member, activityThreadRowCopy(member).taskTitle)
              )
            }
            onSlot={onSlot}
            onFocus={() => focusAgentHubMirror(key)}
            onClose={() => closeAgentHubMirror(key)}
            onMinimize={() => minimizeAgentHubMirror(key)}
            onReveal={() => {
              closeAgentHubMirror(key)
              onReveal(target, thread)
            }}
          />
        )
      })}
      <AgentHubMirrorTray
        items={trayItems}
        trayRef={trayRef}
        anchorRef={hubRef}
        side={traySide}
        alertSide={trayAlertSide}
        hidden={trayHidden || hidden}
        peekMs={trayPeekMs}
        onRestore={restoreAgentHubMirror}
        onReveal={(item) => {
          closeAgentHubMirrorChip(item.key)
          onReveal(item.chip.target, item.thread)
        }}
        onClose={closeAgentHubMirrorChip}
        onOpenAlert={(key, opened) => {
          dismissAgentHubAlert(opened.id)
          // A question is answered on its card; a result is read in the terminal.
          if (opened.kind === 'done') {
            restoreAgentHubMirror(key)
          } else {
            onOpenCard(opened.thread.paneKey)
          }
        }}
        onDismissAlert={dismissAgentHubAlert}
      />
    </div>,
    document.body
  )
}
