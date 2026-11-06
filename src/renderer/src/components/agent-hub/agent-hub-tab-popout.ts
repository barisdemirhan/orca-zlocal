import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { useAppStore } from '@/store'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { isTerminalSourceVisible } from '../terminal-pane/terminal-source-visibility'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { borrowAgentHubTab } from './agent-hub-borrowed-tabs'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { openAgentHubMirrorInLayout } from './agent-hub-floating-arrangement'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function popOutAgentHubTab(target: AgentHubPaneTarget): void {
  const state = useAppStore.getState()
  if (state.settings?.experimentalAgentHub !== true) {
    return
  }
  const existing = findAgentHubMirrorMembership(readAgentHubMirrors(), target)
  if (existing) {
    openAgentHubMirrorInLayout(target)
    return
  }
  const worktreeId = target.worktree.id
  const tab = state.unifiedTabsByWorktree[worktreeId]?.find(
    (item) =>
      (item.contentType === 'terminal' && item.entityId === target.tab.id) ||
      (isStructuredTab(item) && item.id === target.tab.id)
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
      openAgentHubMirrorInLayout(target)
      borrowAgentHubTab({
        worktreeId,
        tabId: target.tab.id,
        unifiedTabId: tab.id,
        groupId: group.id,
        mirrorKey:
          findAgentHubMirrorMembership(readAgentHubMirrors(), target)?.window.id ?? target.tab.id
      })
      return
    }
  }
  openAgentHubMirrorInLayout(target)
}
