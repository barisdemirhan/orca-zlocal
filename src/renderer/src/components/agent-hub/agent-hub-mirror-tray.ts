import type { AgentPaneThread } from '../activity/activity-thread-types'
import { agentHubIndicatorKind, type AgentHubIndicatorKind } from './agent-hub-lists'
import {
  readAgentHubMirrors,
  requestAgentHubMirrorsDock,
  restoreAgentHubMirrors,
  type AgentHubMirrorChip
} from './agent-hub-mirror-store'
import {
  agentHubPaneTargetKey,
  agentHubTargetShowsThread,
  type AgentHubPaneTarget
} from './agent-hub-pane-target'

/** Chips the tray shows before folding the rest into "+N". */
export const AGENT_HUB_TRAY_VISIBLE = 4

// What needs the user first: a question, then a result to read, then work still going.
const URGENCY: Record<AgentHubIndicatorKind, number> = {
  ask: 0,
  done: 1,
  work: 2,
  read: 3,
  idle: 4
}

export type AgentHubTrayEntry = {
  chip: Pick<AgentHubMirrorChip, 'minimizedAt'>
  kind: AgentHubIndicatorKind
}

/** Most urgent first, then most recently minimized; the first entry sits nearest the hub. */
export function orderAgentHubTray<T extends AgentHubTrayEntry>(entries: readonly T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .toSorted(
      (a, b) =>
        URGENCY[a.entry.kind] - URGENCY[b.entry.kind] ||
        b.entry.chip.minimizedAt - a.entry.chip.minimizedAt ||
        b.index - a.index
    )
    .map(({ entry }) => entry)
}

/** The chips on show, and how many wait behind "+N" while the tray is folded. */
export function foldAgentHubTray<T>(
  ordered: readonly T[],
  expanded: boolean
): { shown: readonly T[]; folded: number } {
  if (expanded || ordered.length <= AGENT_HUB_TRAY_VISIBLE) {
    return { shown: ordered, folded: 0 }
  }
  return {
    shown: ordered.slice(0, AGENT_HUB_TRAY_VISIBLE),
    folded: ordered.length - AGENT_HUB_TRAY_VISIBLE
  }
}

/** A mirrored pane's state, from its live thread; a shell (no agent) reads as idle. */
export function agentHubTargetKind(
  threads: readonly AgentPaneThread[],
  target: AgentHubPaneTarget
): AgentHubIndicatorKind {
  const thread = threads.find((candidate) => agentHubTargetShowsThread(target, candidate))
  return thread ? agentHubIndicatorKind(thread) : 'idle'
}

/**
 * The hub's mirrors toggle: sends the open windows to the hub (they fly there), or, with none
 * open, brings back the most urgent parked ones.
 */
export function toggleAgentHubMirrors(
  kindOf: (target: AgentHubPaneTarget) => AgentHubIndicatorKind
): void {
  const { windows, chips } = readAgentHubMirrors()
  if (windows.length > 0) {
    requestAgentHubMirrorsDock()
    return
  }
  const ordered = orderAgentHubTray(chips.map((chip) => ({ chip, kind: kindOf(chip.target) })))
  restoreAgentHubMirrors(ordered.map(({ chip }) => agentHubPaneTargetKey(chip.target)))
}
