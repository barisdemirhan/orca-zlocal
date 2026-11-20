import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { agentHubRequestKey, type AgentHubInboxRequest } from './agent-hub-requests-store'

export type AgentHubInboxCard =
  | { key: string; thread: AgentPaneThread; item?: never }
  | { key: string; item: AgentHubInboxRequest; thread?: never }

export function agentHubInboxCards(
  threads: readonly AgentPaneThread[],
  requests: readonly AgentHubInboxRequest[]
): AgentHubInboxCard[] {
  return [
    ...threads.map((thread) => ({ key: thread.paneKey, thread })),
    ...requests.map((item) => ({
      key: agentHubRequestKey(item.host, item.request.requestId),
      item
    }))
  ]
}
