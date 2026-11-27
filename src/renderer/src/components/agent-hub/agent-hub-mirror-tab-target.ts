import { useMemo } from 'react'
import { shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** What a mirror window shows for this tab, or null while no mirror shows it. */
export function useAgentHubMirroredTargetOfTab(tabId: string): AgentHubPaneTarget | null {
  const mirrors = useAgentHubMirrors()
  return useMemo(() => {
    for (const window of mirrors.windows) {
      for (const tab of window.tabs) {
        const shown = shownAgentHubMirrorTarget(tab)
        if (shown.tab.id === tabId) {
          return shown
        }
      }
    }
    return null
  }, [mirrors, tabId])
}
