import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import {
  setAgentHubTerminalPortals,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { AgentHubMirrorChip } from './AgentHubMirrorChip'
import { AgentHubMirrorWindow } from './AgentHubMirrorWindow'
import { dismissAgentHubAlert } from './agent-hub-alert-queue'
import type { AgentHubAlert } from './agent-hub-alerts'
import {
  closeAgentHubMirror,
  closeAgentHubMirrorChip,
  focusAgentHubMirror,
  minimizeAgentHubMirror,
  moveAgentHubMirrorChip,
  restoreAgentHubMirror,
  useAgentHubMirrors
} from './agent-hub-mirror-store'
import {
  agentHubPaneTargetKey,
  agentHubTargetShowsThread,
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
  threads,
  alerts,
  locationOf,
  onReveal,
  onOpenCard
}: {
  threads: readonly AgentPaneThread[]
  alerts: readonly AgentHubAlert[]
  locationOf: (target: Pick<AgentHubPaneTarget, 'worktree' | 'repo'>) => AgentHubLocation
  onReveal: (target: AgentHubPaneTarget, thread: AgentPaneThread | null) => void
  /** Opens the hub on this waiting agent's card. */
  onOpenCard: (paneKey: string) => void
}): React.JSX.Element | null {
  const { windows, chips } = useAgentHubMirrors()
  const [slots, setSlots] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map())
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
            active: index === windows.length - 1
          }
        ]
      }),
    [windows, slots, surfaces]
  )
  // Why layout: publish before paint so the pane moves in the same frame the window opens.
  useLayoutEffect(() => {
    setAgentHubTerminalPortals(portals)
  }, [portals])
  useLayoutEffect(() => () => setAgentHubTerminalPortals([]), [])

  if (windows.length === 0 && chips.length === 0) {
    return null
  }
  const threadFor = (target: AgentHubPaneTarget): AgentPaneThread | null =>
    threads.find((thread) => agentHubTargetShowsThread(target, thread)) ?? null
  // Why a fixed DOM order: bringing a window forward only changes its z-index; moving its node
  // mid-click would drop the terminal's focus and the pointer.
  const stackIndexOf = new Map(
    windows.map((target, index) => [agentHubPaneTargetKey(target), index])
  )
  const stableWindows = windows.toSorted((a, b) =>
    agentHubPaneTargetKey(a).localeCompare(agentHubPaneTargetKey(b))
  )

  return createPortal(
    <div data-agent-hub-mirrors className="pointer-events-none fixed inset-0 z-[46]">
      {stableWindows.map((target) => {
        const key = agentHubPaneTargetKey(target)
        const index = stackIndexOf.get(key) ?? 0
        const thread = threadFor(target)
        return (
          <AgentHubMirrorWindow
            key={key}
            target={target}
            thread={thread}
            location={locationOf(target)}
            stackIndex={index + 1}
            cascade={index}
            surface={surfaces[index]?.surface ?? 'portal'}
            // The window raises its own pane's alerts; the hub's bubble skips them.
            nudge={
              alerts.findLast((candidate) => agentHubTargetShowsThread(target, candidate.thread)) ??
              null
            }
            onNudged={dismissAgentHubAlert}
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
      {chips.map((chip) => {
        const key = agentHubPaneTargetKey(chip.target)
        const alert =
          alerts.findLast((candidate) =>
            agentHubTargetShowsThread(chip.target, candidate.thread)
          ) ?? null
        return (
          <AgentHubMirrorChip
            key={key}
            chip={chip}
            thread={threadFor(chip.target)}
            location={locationOf(chip.target)}
            alert={alert}
            // Chips stay above every window so a minimized mirror is always reachable.
            stackIndex={windows.length + 1}
            onRestore={() => restoreAgentHubMirror(key)}
            onReveal={() => {
              closeAgentHubMirrorChip(key)
              onReveal(chip.target, threadFor(chip.target))
            }}
            onClose={() => closeAgentHubMirrorChip(key)}
            onMove={(position) => moveAgentHubMirrorChip(key, position)}
            onOpenAlert={(opened) => {
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
        )
      })}
    </div>,
    document.body
  )
}
