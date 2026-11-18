import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { activityThreadStatusId } from '../activity/threads/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { readApprovalTool } from './agent-hub-approval'

export type AgentHubSection = 'needsYou' | 'working' | 'finished'

export type AgentHubLists = Record<AgentHubSection, AgentPaneThread[]> & {
  /** Working workers listed under their working dispatcher instead of as rows. */
  nestedWorking: number
  /** Unread results of workers: kept out of the Inbox, but a minimized mirror still announces them. */
  finishedWorkers: AgentPaneThread[]
  /** When the youngest approval still in its grace period starts needing the user. */
  approvalGraceEndsAt: number | null
}

/**
 * How long an approval prompt must stay open before it needs the user. Why: agents in auto mode
 * raise a prompt and approve it themselves a moment later; only one that lingers is real.
 */
export const AGENT_HUB_APPROVAL_GRACE_MS = 8_000

export type AgentHubCounts = Record<AgentHubSection, number> & {
  /** Workers running under a working dispatcher; `working` counts the dispatchers. */
  nestedWorking?: number
}

/** Classify with the Agents sidebar's own state reading so both surfaces agree. */
export function agentHubSection(thread: AgentPaneThread): AgentHubSection | null {
  switch (activityThreadStatusId(thread)) {
    case 'waiting':
    case 'blocked':
    case 'permission':
      return 'needsYou'
    case 'working':
    case 'monitoring':
      return 'working'
    case 'done':
    case 'failed':
    case 'interrupted':
    case 'unconfirmed':
      return thread.unread ? 'finished' : null
    case 'idle':
    case 'unverifiable':
      return null
  }
}

function threadStatusEntry(thread: AgentPaneThread): AgentStatusEntry | null {
  return thread.currentAgentEntry ?? thread.paneEntry ?? thread.latestEvent?.entry ?? null
}

/** When the thread entered its current state. */
export function agentHubStateSince(thread: AgentPaneThread): number {
  return threadStatusEntry(thread)?.stateStartedAt ?? thread.latestTimestamp
}

/** The structured prompt the agent is waiting on, if the status carries one. */
export function agentHubPromptText(thread: AgentPaneThread): string | null {
  return threadStatusEntry(thread)?.interactivePrompt ?? null
}

/** When the current turn began; a working row shows how long the agent has been at it. */
export function agentHubTurnSince(thread: AgentPaneThread): number {
  const entry = threadStatusEntry(thread)
  return entry?.turnStartedAt ?? entry?.stateStartedAt ?? thread.latestTimestamp
}

export function agentHubToolName(thread: AgentPaneThread): string | null {
  return thread.currentAgentEntry?.toolName?.trim() || null
}

export function buildAgentHubLists(
  threads: readonly AgentPaneThread[],
  options: {
    now?: number
    finishedMaxAgeMs?: number
    /** Worker pane → its dispatcher (see agent-hub-lineage). */
    parentOf?: ReadonlyMap<string, string>
    approvalGraceMs?: number
  } = {}
): AgentHubLists {
  const lists: AgentHubLists = {
    needsYou: [],
    working: [],
    finished: [],
    nestedWorking: 0,
    finishedWorkers: [],
    approvalGraceEndsAt: null
  }
  const { now = 0, finishedMaxAgeMs = 0, parentOf, approvalGraceMs = 0 } = options
  const sectionOf = (thread: AgentPaneThread): AgentHubSection | null => {
    const section = agentHubSection(thread)
    const graceEndsAt = agentHubStateSince(thread) + approvalGraceMs
    if (
      section === 'needsYou' &&
      approvalGraceMs > 0 &&
      now < graceEndsAt &&
      agentHubIsApproval(thread)
    ) {
      // Still deciding by itself, as far as anyone can tell: it reads as working until the grace ends.
      lists.approvalGraceEndsAt = Math.min(lists.approvalGraceEndsAt ?? graceEndsAt, graceEndsAt)
      return 'working'
    }
    return section
  }
  const sections = new Map(threads.map((thread) => [thread.paneKey, sectionOf(thread)]))
  for (const thread of threads) {
    const section = sections.get(thread.paneKey) ?? null
    const parentPaneKey = parentOf?.get(thread.paneKey)
    if (section === 'working' && parentPaneKey && sections.get(parentPaneKey) === 'working') {
      lists.nestedWorking += 1
      continue
    }
    // A worker reports to its dispatcher; its result stays under that agent in All terminals.
    if (section === 'finished' && parentPaneKey) {
      lists.finishedWorkers.push(thread)
      continue
    }
    // "Clear finished after": an old result leaves the hub but stays unread elsewhere.
    if (
      section === 'finished' &&
      finishedMaxAgeMs > 0 &&
      now - agentHubStateSince(thread) > finishedMaxAgeMs
    ) {
      continue
    }
    if (section) {
      lists[section].push(thread)
    }
  }
  // Longest-waiting question and longest-running turn first; newest result first.
  lists.needsYou.sort((a, b) => agentHubStateSince(a) - agentHubStateSince(b))
  lists.working.sort((a, b) => agentHubTurnSince(a) - agentHubTurnSince(b))
  lists.finished.sort((a, b) => agentHubStateSince(b) - agentHubStateSince(a))
  return lists
}

export function agentHubCounts(
  lists: AgentHubLists,
  requestNeedsYou = 0,
  requestFinished = 0
): AgentHubCounts {
  return {
    needsYou: lists.needsYou.length + requestNeedsYou,
    working: lists.working.length,
    finished: lists.finished.length + requestFinished,
    nestedWorking: lists.nestedWorking
  }
}

/** The hub's row/card state vocabulary: asking, working, unread done, read done, idle. */
export type AgentHubIndicatorKind = 'ask' | 'work' | 'done' | 'read' | 'idle'

export function agentHubIndicatorKind(thread: AgentPaneThread): AgentHubIndicatorKind {
  switch (activityThreadStatusId(thread)) {
    case 'waiting':
    case 'blocked':
    case 'permission':
      return 'ask'
    case 'working':
    case 'monitoring':
      return 'work'
    case 'done':
    case 'failed':
    case 'interrupted':
    case 'unconfirmed':
      return thread.unread ? 'done' : 'read'
    case 'idle':
    case 'unverifiable':
      return 'idle'
  }
}

/** True when the waiting prompt is a tool approval rather than a question. */
export function agentHubIsApproval(thread: AgentPaneThread): boolean {
  return readApprovalTool(thread.currentAgentEntry?.interactivePrompt ?? null) !== null
}
