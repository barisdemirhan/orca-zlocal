import { translate } from '@/i18n/i18n'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  countRows,
  type AgentHubGroupNode,
  type AgentHubTerminalRow,
  type AgentHubWorkspaceNode
} from './agent-hub-terminal-tree'

export const AGENT_HUB_SLEEPING_GROUP = 'agent-hub:sleeping'

/** Keep pane identities and workspace ownership while separating sleeping descendants. */
export function groupAgentHubSleepingRows(
  groups: readonly AgentHubGroupNode[],
  isSleeping: (target: AgentHubPaneTarget) => boolean
): AgentHubGroupNode[] {
  const sleepingWorkspaces: AgentHubWorkspaceNode[] = []
  const awakeGroups = groups.flatMap((group) => {
    const workspaces = group.workspaces.flatMap((workspace) => {
      const sleepingRows: AgentHubTerminalRow[] = []
      const partition = (rows: AgentHubTerminalRow[]): AgentHubTerminalRow[] =>
        rows.flatMap((row) => {
          const children = partition(row.children)
          if (!isSleeping(paneTargetFromTerminalRow(row))) {
            return [{ ...row, children }]
          }
          sleepingRows.push({ ...row, children: [] })
          return children
        })
      const rows = partition(workspace.rows)
      if (sleepingRows.length) {
        sleepingWorkspaces.push({
          ...workspace,
          key: `${group.key}:${workspace.key}`,
          rows: sleepingRows
        })
      }
      return rows.length ? [{ ...workspace, rows }] : []
    })
    return workspaces.length ? [{ ...group, workspaces, ...countRows(workspaces) }] : []
  })
  if (sleepingWorkspaces.length) {
    awakeGroups.push({
      key: AGENT_HUB_SLEEPING_GROUP,
      label: translate('agentHub.sleep.group', 'Sleeping'),
      workspaces: sleepingWorkspaces,
      ...countRows(sleepingWorkspaces)
    })
  }
  return awakeGroups
}
