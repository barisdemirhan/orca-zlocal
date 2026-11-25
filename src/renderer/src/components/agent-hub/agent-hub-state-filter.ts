import { useMemo } from 'react'
import { agentHubIndicatorKind } from './agent-hub-lists'
import { useAgentHubSleepingTargetTest } from './agent-hub-pane-sleep'
import { AGENT_HUB_SLEEPING_GROUP, groupAgentHubSleepingRows } from './agent-hub-sleeping-groups'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { agentHubRowIsIdleAgent } from './agent-hub-tree-bot-groups'
import {
  useAgentHubWindowFilterRowTest,
  type AgentHubWindowFilter
} from './agent-hub-window-filter'

export type AgentHubStateFilter = 'all' | 'ask' | 'work' | 'done' | 'idle' | 'sleep'
export const AGENT_HUB_STATE_FILTERS: readonly AgentHubStateFilter[] = [
  'all',
  'ask',
  'work',
  'done',
  'idle',
  'sleep'
]

export type AgentHubStateCounts = Record<Exclude<AgentHubStateFilter, 'all'>, number>

/** The chip a row answers to; shells answer to none. */
function rowState(row: AgentHubTerminalRow): Exclude<AgentHubStateFilter, 'all' | 'sleep'> | null {
  if (agentHubRowIsIdleAgent(row)) {
    return 'idle'
  }
  const kind = row.thread ? agentHubIndicatorKind(row.thread) : null
  return kind === 'ask' || kind === 'work' ? kind : kind ? 'done' : null
}

export function agentHubRowMatchesState(
  row: AgentHubTerminalRow,
  filter: AgentHubStateFilter
): boolean {
  return filter === 'all' || rowState(row) === filter
}

/** Sleeping shows only its own group; any other chip leaves that group out. */
export function applyAgentHubStateGroupFilter(
  groups: readonly AgentHubGroupNode[],
  filter: AgentHubStateFilter
): AgentHubGroupNode[] {
  if (filter === 'all') {
    return [...groups]
  }
  return groups.filter((group) => (group.key === AGENT_HUB_SLEEPING_GROUP) === (filter === 'sleep'))
}

function tally(rows: readonly AgentHubTerminalRow[], into: AgentHubStateCounts, sleeping: boolean) {
  for (const row of rows) {
    if (sleeping) {
      into.sleep++
    } else {
      const state = rowState(row)
      if (state) {
        into[state]++
      }
    }
    tally(row.children, into, sleeping)
  }
}

/** Counts over the host- and placement-filtered tree, before search and the chips themselves. */
export function useAgentHubStateCounts(
  tree: readonly AgentHubGroupNode[],
  windowFilter: AgentHubWindowFilter,
  hostTest?: (row: AgentHubTerminalRow) => boolean
): AgentHubStateCounts {
  const isSleeping = useAgentHubSleepingTargetTest()
  const windowTest = useAgentHubWindowFilterRowTest(windowFilter)
  return useMemo(() => {
    const counts: AgentHubStateCounts = { ask: 0, work: 0, done: 0, idle: 0, sleep: 0 }
    const keep = (row: AgentHubTerminalRow): boolean =>
      (!windowTest || windowTest(row)) && (!hostTest || hostTest(row))
    for (const group of groupAgentHubSleepingRows(tree, isSleeping)) {
      const sleeping = group.key === AGENT_HUB_SLEEPING_GROUP
      for (const workspace of group.workspaces) {
        tally(flattenKept(workspace.rows, keep), counts, sleeping)
      }
    }
    return counts
  }, [tree, isSleeping, windowTest, hostTest])
}

function flattenKept(
  rows: readonly AgentHubTerminalRow[],
  keep: (row: AgentHubTerminalRow) => boolean
): AgentHubTerminalRow[] {
  return rows.filter(keep).map((row) => ({ ...row, children: row.children.filter(keep) }))
}
