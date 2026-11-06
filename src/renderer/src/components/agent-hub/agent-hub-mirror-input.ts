import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function findAttachedAgentHubMirrorInput(
  root: HTMLElement,
  target: { tab: Pick<AgentHubPaneTarget['tab'], 'id'>; paneKey: string | null }
): HTMLElement | null {
  // A tab popped out from the tab bar has no pane key: use its active leaf so hidden split panes are skipped.
  const leafId = target.paneKey
    ? parsePaneKey(target.paneKey)?.leafId
    : useAppStore.getState().terminalLayoutsByTabId[target.tab.id]?.activeLeafId
  for (const tab of root.querySelectorAll<HTMLElement>('[data-terminal-tab-id]')) {
    if (tab.dataset.terminalTabId !== target.tab.id) {
      continue
    }
    for (const input of tab.querySelectorAll<HTMLElement>('.xterm-helper-textarea')) {
      if (!leafId || input.closest<HTMLElement>('.pane[data-leaf-id]')?.dataset.leafId === leafId) {
        return input
      }
    }
  }
  return null
}
