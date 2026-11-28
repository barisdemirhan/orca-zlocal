import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { agentHubRequestHost, agentHubTargetPane } from './agent-hub-request-target'
import { readAgentHubRequests, subscribeAgentHubRequests } from './agent-hub-requests-store'

function anyAgentHubProgress(): boolean {
  for (const host of readAgentHubRequests().values()) {
    if (host.progressByPane.size > 0) {
      return true
    }
  }
  return false
}

export function useAgentHubProgress(target: AgentHubPaneTarget | undefined): string | null {
  // Why first: rows and tabs mount this for every pane, and almost none carry a progress line.
  const tracked = useSyncExternalStore(subscribeAgentHubRequests, anyAgentHubProgress)
  const watched = tracked ? target : undefined
  const host = useAppStore((state) =>
    watched ? agentHubRequestHost(state, watched.worktree) : null
  )
  const paneKey = useAppStore((state) =>
    watched ? (watched.paneKey ?? agentHubTargetPane(state, watched)?.paneKey ?? null) : null
  )
  return useSyncExternalStore(subscribeAgentHubRequests, () =>
    host && paneKey
      ? (readAgentHubRequests().get(host)?.progressByPane.get(paneKey)?.text ?? null)
      : null
  )
}
