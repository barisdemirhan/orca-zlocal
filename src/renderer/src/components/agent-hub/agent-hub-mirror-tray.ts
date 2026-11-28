import { agentHubMirrorWindowKind } from './agent-hub-mirror-window-kind'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { agentHubIndicatorKind, type AgentHubIndicatorKind } from './agent-hub-lists'
import {
  agentHubMirrorWindowCap,
  readAgentHubMirrors,
  requestAgentHubMirrorsDock,
  restoreAgentHubMirrors,
  type AgentHubMirrorChip
} from './agent-hub-mirror-store'
import { agentHubTargetShowsThread, type AgentHubPaneTarget } from './agent-hub-pane-target'

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

/** What the hub's mirrors toggle does now: bring parked mirrors back, or send the open ones away. */
export function agentHubMirrorsToggleAction(
  mirrors: { windows: number; chips: number },
  cap = agentHubMirrorWindowCap()
): 'restore' | 'dock' | 'none' {
  // Parked ones come back first, while there is room for another window.
  if (mirrors.chips > 0 && mirrors.windows < cap) {
    return 'restore'
  }
  return mirrors.windows > 0 ? 'dock' : 'none'
}

/**
 * The hub's mirrors toggle. With mirrors parked it brings them back (most urgent first, up to
 * the window cap) beside the ones already open, laid out in the default layout; with every
 * mirror open it sends them all to the hub (they fly there).
 */
export function toggleAgentHubMirrors(
  kindOf: (target: AgentHubPaneTarget) => AgentHubIndicatorKind,
  arrange: () => void
): void {
  const { windows, chips } = readAgentHubMirrors()
  const action = agentHubMirrorsToggleAction({ windows: windows.length, chips: chips.length })
  if (action === 'dock') {
    requestAgentHubMirrorsDock()
    return
  }
  if (action === 'none') {
    return
  }
  const ordered = orderAgentHubTray(
    chips.map((chip) => ({ chip, kind: agentHubMirrorWindowKind(chip.window, kindOf) }))
  )
  restoreAgentHubMirrors(
    ordered.slice(0, agentHubMirrorWindowCap() - windows.length).map(({ chip }) => chip.window.id)
  )
  arrange()
}
