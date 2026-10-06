import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { DashboardAgentRow } from '../dashboard/useDashboardData'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { agentHubRowOfTab } from './agent-hub-tab-auto-popout'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'

export function agentHubSidebarPopoutTarget(
  agent: DashboardAgentRow,
  tree: readonly AgentHubGroupNode[],
  enabled: boolean,
  visibleWorkspaceId: string | null
): AgentHubPaneTarget | null {
  if (!enabled || agent.rowSource === 'subagent' || agent.rowSource === 'retained') {
    return null
  }
  const pane = parsePaneKey(agent.paneKey)
  if (!pane || pane.tabId !== agent.tab.id) {
    return null
  }
  const row = agentHubRowOfTab(tree, agent.tab.id)
  if (!row || row.worktree.id === visibleWorkspaceId) {
    return null
  }
  return { ...paneTargetFromTerminalRow(row), paneKey: agent.paneKey, agentType: agent.agentType }
}
