import {
  agentHubMirrorSourceKey,
  agentHubMirrorWindows,
  type AgentHubMirrorState
} from './agent-hub-mirror-membership'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { paneTargetFromTerminalRow, paneTargetFromThread } from './agent-hub-pane-target'
import {
  countRows,
  type AgentHubGroupNode,
  type AgentHubTerminalRow
} from './agent-hub-terminal-tree'

function reservedSources(mirrors: AgentHubMirrorState): ReadonlySet<string> {
  return new Set(
    agentHubMirrorWindows(mirrors).flatMap((window) =>
      window.tabs.map((tab) => agentHubMirrorSourceKey(tab.target))
    )
  )
}

/** Workers of a reserved dispatcher stay in their own workspace before tree nesting. */
export function availableAgentHubPickerParents(
  parentOf: ReadonlyMap<string, string>,
  threads: readonly AgentPaneThread[],
  mirrors: AgentHubMirrorState
): ReadonlyMap<string, string> {
  const reserved = reservedSources(mirrors)
  const reservedParents = new Set(
    threads
      .filter((thread) => reserved.has(agentHubMirrorSourceKey(paneTargetFromThread(thread, ''))))
      .map((thread) => thread.paneKey)
  )
  return new Map([...parentOf].filter(([, parent]) => !reservedParents.has(parent)))
}

/** Promote eligible workers when their dispatcher is reserved, without keeping a disabled parent. */
export function availableAgentHubPickerTree(
  groups: readonly AgentHubGroupNode[],
  mirrors: AgentHubMirrorState
): AgentHubGroupNode[] {
  const reserved = reservedSources(mirrors)
  const project = (row: AgentHubTerminalRow): AgentHubTerminalRow[] => {
    const children = row.children.flatMap(project)
    return reserved.has(agentHubMirrorSourceKey(paneTargetFromTerminalRow(row)))
      ? children
      : [{ ...row, children }]
  }
  return groups.flatMap((group) => {
    const workspaces = group.workspaces.flatMap((workspace) => {
      const rows = workspace.rows.flatMap(project)
      return rows.length ? [{ ...workspace, rows }] : []
    })
    return workspaces.length ? [{ ...group, workspaces, ...countRows(workspaces) }] : []
  })
}
