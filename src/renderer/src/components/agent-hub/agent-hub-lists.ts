import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { threadAgentState } from '../activity/activity-thread-presentation'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { readApprovalTool } from './agent-hub-approval'

export type AgentHubSection = 'needsYou' | 'working' | 'finished'

export type AgentHubLists = Record<AgentHubSection, AgentPaneThread[]>

export type AgentHubCounts = Record<AgentHubSection, number>

/** Classify with the Agents sidebar's own state reading so both surfaces agree. */
export function agentHubSection(thread: AgentPaneThread): AgentHubSection | null {
  switch (threadAgentState(thread)) {
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

/** When the current turn began; a working row shows how long the agent has been at it. */
export function agentHubTurnSince(thread: AgentPaneThread): number {
  const entry = threadStatusEntry(thread)
  return entry?.turnStartedAt ?? entry?.stateStartedAt ?? thread.latestTimestamp
}

export function agentHubToolName(thread: AgentPaneThread): string | null {
  return thread.currentAgentEntry?.toolName?.trim() || null
}

export function buildAgentHubLists(threads: readonly AgentPaneThread[]): AgentHubLists {
  const lists: AgentHubLists = { needsYou: [], working: [], finished: [] }
  for (const thread of threads) {
    const section = agentHubSection(thread)
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

export function agentHubCounts(lists: AgentHubLists): AgentHubCounts {
  return {
    needsYou: lists.needsYou.length,
    working: lists.working.length,
    finished: lists.finished.length
  }
}

/** The hub's row/card state vocabulary: asking, working, unread done, read done, idle. */
export type AgentHubIndicatorKind = 'ask' | 'work' | 'done' | 'read' | 'idle'

export function agentHubIndicatorKind(thread: AgentPaneThread): AgentHubIndicatorKind {
  switch (threadAgentState(thread)) {
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
