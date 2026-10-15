import {
  AGENT_HUB_ORB_OPENING_PROMPT,
  type AgentHubOrbConversation
} from '../../../shared/agent-hub-orb'
import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import { isStructuredAgentId } from '../../../shared/agent-session-provider-handle'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/structured-agent-session-host'

export async function listAgentHubOrbConversations(
  host: StructuredAgentSessionHost,
  records: AgentSessionRecord[],
  limit: number
): Promise<AgentHubOrbConversation[]> {
  const conversations: AgentHubOrbConversation[] = []
  for (const record of records) {
    if (!isStructuredAgentId(record.provider)) {
      continue
    }
    const snapshot = await host.journalSnapshot(record.sessionId)
    const messages = snapshot.items.flatMap((item) => {
      if (item.body.kind !== 'message') {
        return []
      }
      const text = item.body.blocks
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join(' ')
        .trim()
      return [{ role: item.body.role, text }]
    })
    const firstUser = messages.find(
      (message) => message.role === 'user' && message.text !== AGENT_HUB_ORB_OPENING_PROMPT
    )
    const lastReply = messages.findLast((message) => message.role === 'assistant')?.text
    conversations.push({
      sessionId: record.sessionId,
      agent: record.provider,
      ...(record.options?.model ? { model: record.options.model } : {}),
      title: (record.conversationName || firstUser?.text || 'Orb').slice(0, 120),
      startedAt: record.createdAt,
      lastActiveAt: Math.max(record.updatedAt, ...snapshot.items.map((item) => item.observedAt)),
      ...(lastReply ? { lastReply: lastReply.slice(0, 240) } : {})
    })
  }
  return conversations.sort((left, right) => right.lastActiveAt - left.lastActiveAt).slice(0, limit)
}
