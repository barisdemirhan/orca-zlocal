import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { agentHubMirrorSourceKey, agentHubMirrorWindows } from './agent-hub-mirror-membership'
import { noteAgentHubMirrorTurnStarted } from './agent-hub-mirror-drawer-store'
import { readAgentHubMirrors } from './agent-hub-mirror-store'

/** A drawer the person closes stays closed for the rest of the agent's turn; a new turn clears that. */
export function watchAgentHubMirrorTurns(): () => void {
  return useAppStore.subscribe((state, previous) => {
    if (state.agentStatusByPaneKey === previous.agentStatusByPaneKey) {
      return
    }
    const started = new Set<string>()
    for (const [paneKey, entry] of state.agentStatusByPaneKey) {
      if (
        entry.state === 'working' &&
        previous.agentStatusByPaneKey.get(paneKey)?.state !== 'working'
      ) {
        const tabId = parsePaneKey(paneKey)?.tabId
        if (tabId) {
          started.add(tabId)
        }
      }
    }
    if (!started.size) {
      return
    }
    for (const window of agentHubMirrorWindows(readAgentHubMirrors())) {
      for (const tab of window.tabs) {
        if (started.has(tab.target.tab.id)) {
          noteAgentHubMirrorTurnStarted(agentHubMirrorSourceKey(tab.target))
        }
      }
    }
  })
}
