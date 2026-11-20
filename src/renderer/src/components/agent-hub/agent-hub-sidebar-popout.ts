import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { DashboardAgentRow } from '../dashboard/rows/dashboard-agent-row'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { agentHubRowOfTab } from './agent-hub-tab-row'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'

// Cheap row-only rules, safe to evaluate on every sidebar render.
export function canPopOutAgentHubSidebarRow(
  agent: DashboardAgentRow,
  visibleWorkspaceId: string | null
): boolean {
  if (agent.rowSource === 'subagent') {
    return false
  }
  const pane = parsePaneKey(agent.paneKey)
  if (!pane || pane.tabId !== agent.tab.id) {
    return false
  }
  return agent.tab.worktreeId !== visibleWorkspaceId
}

export function agentHubSidebarPopoutTarget(
  agent: DashboardAgentRow,
  tree: readonly AgentHubGroupNode[],
  enabled: boolean,
  visibleWorkspaceId: string | null
): AgentHubPaneTarget | null {
  if (!enabled || !canPopOutAgentHubSidebarRow(agent, visibleWorkspaceId)) {
    return null
  }
  const row = agentHubRowOfTab(tree, agent.tab.id)
  if (!row || row.worktree.id === visibleWorkspaceId) {
    return null
  }
  return { ...paneTargetFromTerminalRow(row), paneKey: agent.paneKey, agentType: agent.agentType }
}
