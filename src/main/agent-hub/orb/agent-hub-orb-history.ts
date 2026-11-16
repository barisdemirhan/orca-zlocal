import type { AgentHubOrbConversation } from '../../../shared/agent-hub-orb'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import { isStructuredAgentId } from '../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import { isOrbOpeningText } from '../../../shared/native-chat/native-chat-provider-frame-summary'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'

export async function listAgentHubOrbConversations(
  host: StructuredAgentSessionHost,
  records: AgentSessionRecord[],
  limit: number
): Promise<AgentHubOrbConversation[]> {
  const conversations: AgentHubOrbConversation[] = []
  const recent = records
    .filter((record) => isStructuredAgentId(record.provider))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, limit)
  for (const record of recent) {
    if (!isStructuredAgentId(record.provider)) {
      continue
    }
    const snapshot = await host.journalSnapshot(record.sessionId)
    let lastActiveAt = record.updatedAt
    for (const item of snapshot.items) {
      lastActiveAt = Math.max(lastActiveAt, item.observedAt)
    }
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
      (message) => message.role === 'user' && message.text && !isOrbOpeningText(message.text)
    )
    const lastReply = messages.findLast((message) => message.role === 'assistant')?.text
    conversations.push({
      sessionId: record.sessionId,
      agent: record.provider,
      ...(record.options?.model ? { model: record.options.model } : {}),
      // Empty means untitled; the renderer shows a translated placeholder.
      title: (record.conversationName || firstUser?.text || '').slice(0, 120),
      startedAt: record.createdAt,
      lastActiveAt,
      ...(lastReply ? { lastReply: lastReply.slice(0, 240) } : {})
    })
  }
  return conversations.sort((left, right) => right.lastActiveAt - left.lastActiveAt)
}
