import { useAppStore } from '@/store'
import { isTerminalSourceVisible } from '../terminal-pane/terminal-source-visibility'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { borrowAgentHubTab } from './agent-hub-borrowed-tabs'
import { openAgentHubMirror, readAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubPaneTargetKey, type AgentHubPaneTarget } from './agent-hub-pane-target'

export function popOutAgentHubTab(target: AgentHubPaneTarget): void {
  const state = useAppStore.getState()
  if (state.settings?.experimentalAgentHub !== true) {
    return
  }
  const { windows, chips } = readAgentHubMirrors()
  const existing = [...windows, ...chips.map((chip) => chip.target)].find(
    (item) => item.worktree.id === target.worktree.id && item.tab.id === target.tab.id
  )
  if (existing) {
    openAgentHubMirror(existing)
    return
  }
  const worktreeId = target.worktree.id
  const tab = state.unifiedTabsByWorktree[worktreeId]?.find(
    (item) => item.contentType === 'terminal' && item.entityId === target.tab.id
  )
  const group = state.groupsByWorktree[worktreeId]?.find((item) => item.id === tab?.groupId)
  const visible = isTerminalSourceVisible(state, worktreeId, target.tab.id, isAgentHubCanvasOpen())
  if (visible && tab && group) {
    const index = group.tabOrder.indexOf(tab.id)
    const neighbor = group.tabOrder[index + 1] ?? group.tabOrder[index - 1]
    if (neighbor) {
      state.activateTab(neighbor, { worktreeId })
      state.focusGroup(worktreeId, group.id)
    } else {
      openAgentHubMirror(target)
      borrowAgentHubTab({
        worktreeId,
        tabId: target.tab.id,
        unifiedTabId: tab.id,
        groupId: group.id,
        mirrorKey: agentHubPaneTargetKey(target)
      })
      return
    }
  }
  openAgentHubMirror(target)
}
