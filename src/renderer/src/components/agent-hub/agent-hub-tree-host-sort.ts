import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'

function hostRank(id: string | undefined): string {
  return !id || id === LOCAL_EXECUTION_HOST_ID ? '' : id
}

/** Within each group, workspaces of the same host sit together (local first); ties keep their order. */
export function sortAgentHubWorkspacesByHost(
  groups: readonly AgentHubGroupNode[]
): AgentHubGroupNode[] {
  return groups.map((group) => ({
    ...group,
    workspaces: group.workspaces
      .map((workspace, index) => ({
        workspace,
        index,
        host: hostRank(workspace.worktree.hostId)
      }))
      .sort((a, b) => a.host.localeCompare(b.host) || a.index - b.index)
      .map(({ workspace }) => workspace)
  }))
}
