import type { AppState } from '@/store/types'
import { agentHubRowOfTab } from './agent-hub-tab-row'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'

let selectedTarget: AgentHubPaneTarget | null = null

export function registerAgentHubSelectedTarget(target: AgentHubPaneTarget | null): () => void {
  selectedTarget = target
  return () => {
    if (selectedTarget === target) {
      selectedTarget = null
    }
  }
}

export function agentHubActiveTarget(state: AppState): AgentHubPaneTarget | null {
  if (selectedTarget) {
    return selectedTarget
  }
  if (state.activeView !== 'terminal' || !state.activeTabId) {
    return null
  }
  const row = agentHubRowOfTab(
    agentHubTerminalTreeFromState(state, [], true, new Map()),
    state.activeTabId
  )
  if (!row) {
    return null
  }
  const target = paneTargetFromTerminalRow(row)
  const leafId = state.terminalLayoutsByTabId[row.tab.id]?.activeLeafId
  return { ...target, paneKey: leafId ? makePaneKey(row.tab.id, leafId) : null }
}
