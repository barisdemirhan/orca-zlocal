import { useMemo } from 'react'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import { useAgentHubOrbChatStatuses } from './use-agent-hub-orb-chat-statuses'

export type AgentHubOrbSideAsk = { id: string; title: string }

/** The open side chat that is asking, if any; the sphere turns orange and a click opens that chat. */
export function useAgentHubOrbSideAsk(sessionId: string): AgentHubOrbSideAsk | null {
  const chats = useAgentHubOrbChatStrip((s) => s.strip.chats)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const ids = useMemo(
    () => chats.map((chat) => chat.id).filter((id) => id !== AGENT_HUB_ORB_HOME_CHAT),
    [chats]
  )
  const statuses = useAgentHubOrbChatStatuses(ids, sessionId)
  const id = ids.find((entry) => statuses.get(entry) === 'attention')
  return id ? { id, title: meta[id]?.title ?? '' } : null
}
