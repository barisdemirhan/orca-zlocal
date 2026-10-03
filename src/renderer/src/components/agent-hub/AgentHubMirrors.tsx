import { createPortal } from 'react-dom'
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

/**
 * Every open mirror window and minimized chip, in one layer: above the floating workspace
 * panel (z-45) and below modal layers (z-50). Inside it, the window clicked last is in front.
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
