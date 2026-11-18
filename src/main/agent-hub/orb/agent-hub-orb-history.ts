import type { AgentHubOrbConversation } from '../../../shared/agent-hub-orb'
import type { AgentSessionRecord } from '../../../shared/agent-session/lifecycle/agent-session-record'
import { isStructuredAgentId } from '../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import { isOrbOpeningText } from '../../../shared/native-chat/transcript/notices/native-chat-provider-frame-summary'
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
    const [reads, outline] = await Promise.all([
      host.attentionReads.journal(record.sessionId),
      host.conversationOutline(record.sessionId)
    ])
    const lastActiveAt = Math.max(record.updatedAt, await reads.lastActivityAt())
    const firstUser = outline.entries.find(
      (entry) => entry.preview && !isOrbOpeningText(entry.preview)
    )
    const lastReply = outline.entries.findLast((entry) => entry.reply)?.reply
    conversations.push({
      sessionId: record.sessionId,
      agent: record.provider,
      ...(record.options?.model ? { model: record.options.model } : {}),
      // Empty means untitled; the renderer shows a translated placeholder.
      title: (record.conversationName || firstUser?.preview || '').slice(0, 120),
      startedAt: record.createdAt,
      lastActiveAt,
      ...(lastReply ? { lastReply: lastReply.slice(0, 240) } : {})
    })
  }
  return conversations.sort((left, right) => right.lastActiveAt - left.lastActiveAt)
}
