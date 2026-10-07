import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function findAttachedAgentHubMirrorInput(
  root: HTMLElement,
  target: { tab: Pick<AgentHubPaneTarget['tab'], 'id'>; paneKey: string | null }
): HTMLElement | null {
  const leafId = target.paneKey ? parsePaneKey(target.paneKey)?.leafId : null
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
