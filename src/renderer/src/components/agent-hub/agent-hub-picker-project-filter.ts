import { projectGroupIdFromRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../shared/worktree/types'
import type { AgentHubGroupNode, AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { filterAgentHubTerminalTreeRows } from './agent-hub-terminal-tree-view'

export type AgentHubPickerProject = {
  key: string
  label: string
  /** Set only when workspaces span several hosts (see useAgentHubHostLabels). */
  hostLabel: string | null
}

/** One project on one host; a folder workspace's repoId names its group, so it keys by itself. */
export function agentHubPickerProjectKey(
  worktree: Pick<Worktree, 'id' | 'hostId' | 'repoId'>
): string {
  return projectGroupIdFromRepoId(worktree.repoId)
    ? `folder\u0000${getWorktreeHostIdentity(worktree)}`
    : `repo\u0000${worktree.hostId ?? ''}\u0000${worktree.repoId}`
}

export function agentHubPickerProjectKeys(
  worktrees: readonly Pick<Worktree, 'id' | 'hostId' | 'repoId'>[]
): ReadonlySet<string> {
  return new Set(worktrees.map(agentHubPickerProjectKey))
}

/** Every project in the tree, workers nested under another project's dispatcher included. */
export function agentHubPickerProjects(
  groups: readonly AgentHubGroupNode[],
  hostLabels?: ReadonlyMap<string, string>
): AgentHubPickerProject[] {
  const projects = new Map<string, AgentHubPickerProject>()
  const visit = (row: AgentHubTerminalRow, workspaceLabel: string | null): void => {
    const key = agentHubPickerProjectKey(row.worktree)
    if (!projects.has(key)) {
      projects.set(key, {
        key,
        label: workspaceLabel ?? row.repo?.displayName ?? row.worktree.displayName,
        hostLabel: hostLabels?.get(getWorktreeHostIdentity(row.worktree)) ?? null
      })
    }
    row.children.forEach((child) => visit(child, null))
  }
  for (const group of groups) {
    for (const workspace of group.workspaces) {
      workspace.rows.forEach((row) =>
        visit(row, row.worktree.id === workspace.worktree.id ? workspace.projectLabel : null)
      )
    }
  }
  return [...projects.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/** An empty selection means no filter. */
export function filterAgentHubTreeByProjects(
  groups: readonly AgentHubGroupNode[],
  keys: ReadonlySet<string>
): AgentHubGroupNode[] {
  return keys.size === 0
    ? [...groups]
    : filterAgentHubTerminalTreeRows(groups, (row) =>
        keys.has(agentHubPickerProjectKey(row.worktree))
      )
}
