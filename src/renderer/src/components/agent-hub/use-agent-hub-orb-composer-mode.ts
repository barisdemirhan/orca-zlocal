import { useAgentHubOrbChatStrip, type OrbStripWorker } from './agent-hub-orb-chat-strip-store'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export type AgentHubOrbComposerMode =
  | { kind: 'none' }
  | { kind: 'asleep' }
  | { kind: 'worker'; chatId: string; title: string; worker: OrbStripWorker }

/** What stands in for the composer of a chat tab shown in the Orb window. */
export function useAgentHubOrbComposerMode(tabId: string): AgentHubOrbComposerMode {
  const asleep = useAgentHubOrbPanel((s) => s.asleep)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const chatId = Object.keys(meta).find((id) => meta[id]?.tabId === tabId)
  const entry = chatId ? meta[chatId] : undefined
  if (chatId && entry?.worker) {
    return { kind: 'worker', chatId, title: entry.title, worker: entry.worker }
  }
  return asleep ? { kind: 'asleep' } : { kind: 'none' }
}
