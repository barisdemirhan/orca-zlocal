import {
  agentChildRowContextForParent,
  buildAgentChildRowModels,
  buildLegacyAgentChildRowModels,
  flattenAgentChildRowModels,
  type AgentChildRowModel
} from '../../../../shared/agent-status/presentation/agent-child-row-model'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  isAgentStatusFresh as isExplicitAgentStatusFresh
} from '../../../../shared/agent-status/contracts/agent-status-freshness'
import { buildChildAgentLineageTree } from '../activity/activity-thread-child-agent'
import type { AgentPaneThread } from '../activity/activity-thread-types'
import { agentHubSection, type AgentHubCounts, type AgentHubIndicatorKind } from './agent-hub-lists'

/** What runs beneath one agent: worker panes it dispatched, and its in-process subagents. */
export type AgentHubChildren = {
  workers: readonly AgentPaneThread[]
  subagents: readonly AgentChildRowModel[]
}

export type AgentHubLineage = {
  /** Worker pane → the listed agent pane that dispatched it. */
  parentOf: ReadonlyMap<string, string>
  childrenOf: (paneKey: string) => AgentHubChildren
}

const NO_CHILDREN: AgentHubChildren = { workers: [], subagents: [] }

export const EMPTY_AGENT_HUB_LINEAGE: AgentHubLineage = {
  parentOf: new Map(),
  childrenOf: () => NO_CHILDREN
}

function subagentRows(thread: AgentPaneThread, now: number): AgentChildRowModel[] {
  const entry = thread.paneEntry ?? thread.currentAgentEntry
  if (!entry || (entry.children === undefined && !entry.subagents?.length)) {
    return []
  }
  const context = agentChildRowContextForParent(
    entry,
    isExplicitAgentStatusFresh(entry, now, AGENT_STATUS_STALE_AFTER_MS)
  )
  const rows =
    entry.children !== undefined
      ? buildAgentChildRowModels(entry.children, context)
      : buildLegacyAgentChildRowModels(entry.subagents ?? [], context)
  // Like the sidebar: shells and monitors show through their owner's state.
  return flattenAgentChildRowModels(rows).filter((row) => row.kind === 'agent')
}

/** Orchestration parents win; CLI-created panes fold only in Hub. */
export function buildAgentHubLineage(
  threads: readonly AgentPaneThread[],
  now: number
): AgentHubLineage {
  const tree = buildChildAgentLineageTree(threads, true)
  const threadByPaneKey = new Map(threads.map((thread) => [thread.paneKey, thread]))
  const parentOf = new Map<string, string>()
  const workersOf = new Map<string, AgentPaneThread[]>()
  for (const [parentPaneKey, rows] of tree.childrenByParentPaneKey) {
    const workers = rows.flatMap((row) => threadByPaneKey.get(row.paneKey) ?? [])
    for (const worker of workers) {
      parentOf.set(worker.paneKey, parentPaneKey)
    }
    workersOf.set(parentPaneKey, workers)
  }
  const subagentsOf = new Map<string, AgentChildRowModel[]>()
  for (const thread of threads) {
    const rows = subagentRows(thread, now)
    if (rows.length > 0) {
      subagentsOf.set(thread.paneKey, rows)
    }
  }
  return {
    parentOf,
    childrenOf: (paneKey) => {
      const workers = workersOf.get(paneKey)
      const subagents = subagentsOf.get(paneKey)
      return workers || subagents
        ? { workers: workers ?? [], subagents: subagents ?? [] }
        : NO_CHILDREN
    }
  }
}

export function agentHubSubagentKind(row: AgentChildRowModel): AgentHubIndicatorKind {
  switch (row.displayState) {
    case 'working':
    case 'monitoring':
      return 'work'
    case 'waiting':
    case 'blocked':
      return 'ask'
    case 'done':
    case 'failed':
    case 'interrupted':
      return 'read'
    case 'idle':
    case 'unverifiable':
      return 'idle'
  }
}

/** Only children still at work (or stuck asking): the Running tab's view of a parent. */
export function activeAgentHubChildren(children: AgentHubChildren): AgentHubChildren {
  return {
    workers: children.workers.filter((thread) => agentHubSection(thread) === 'working'),
    subagents: children.subagents.filter((row) => {
      const kind = agentHubSubagentKind(row)
      return kind === 'work' || kind === 'ask'
    })
  }
}

export function agentHubChildCounts(children: AgentHubChildren): AgentHubCounts {
  const counts: AgentHubCounts = { needsYou: 0, working: 0, finished: 0 }
  for (const thread of children.workers) {
    const section = agentHubSection(thread)
    if (section) {
      counts[section] += 1
    }
  }
  for (const row of children.subagents) {
    const kind = agentHubSubagentKind(row)
    if (kind === 'ask') {
      counts.needsYou += 1
    } else if (kind === 'work') {
      counts.working += 1
    }
  }
  return counts
}

/** Running rows in display order, unfolded workers included: the arrow-key selection space. */
export function visibleAgentHubRunningThreads(
  working: readonly AgentPaneThread[],
  lineage: AgentHubLineage,
  expandedKeys: ReadonlySet<string>
): AgentPaneThread[] {
  const withWorkers = (thread: AgentPaneThread): AgentPaneThread[] =>
    expandedKeys.has(thread.paneKey)
      ? [
          thread,
          ...activeAgentHubChildren(lineage.childrenOf(thread.paneKey)).workers.flatMap(withWorkers)
        ]
      : [thread]
  return working.flatMap(withWorkers)
}
