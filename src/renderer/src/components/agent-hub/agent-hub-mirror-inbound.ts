import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'

export type AgentHubMirrorInboundKind = 'agent' | 'connector' | 'person' | 'automation'

export type AgentHubMirrorInboundRow = {
  id: string
  kind: AgentHubMirrorInboundKind
  /** Who sent it, as the transcript recorded it; null when it only says what kind. */
  sender: string | null
  preview: string
  timestamp: number | null
}

const MAX_ROWS = 20
const PREVIEW_CHARS = 140
// Bounds the scan so a long transcript with no inbound mail costs the same per update.
const MAX_SCANNED = 400

function previewOf(message: NativeChatMessage): string {
  const text = message.blocks
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text
}

function inboundOf(message: NativeChatMessage): AgentHubMirrorInboundRow | null {
  if (message.role !== 'user') {
    return null
  }
  const base = { id: message.id, preview: previewOf(message), timestamp: message.timestamp }
  if (message.from?.kind === 'agent') {
    const names = message.from.senders.flatMap((sender) => (sender.name ? [sender.name] : []))
    return { ...base, kind: 'agent', sender: names.length > 0 ? names.join(', ') : null }
  }
  if (message.asker) {
    return { ...base, kind: 'connector', sender: message.asker.name ?? message.asker.source }
  }
  if (message.typedByOther) {
    return { ...base, kind: 'person', sender: message.typedByOther.name }
  }
  if (message.automationRun) {
    return { ...base, kind: 'automation', sender: message.automationRun.automation.name }
  }
  return null
}

/** The last inbound user-role rows (other agents, connectors, other people, automations), newest last. */
export function selectAgentHubMirrorInbound(
  messages: readonly NativeChatMessage[]
): AgentHubMirrorInboundRow[] {
  const rows: AgentHubMirrorInboundRow[] = []
  const stop = Math.max(0, messages.length - MAX_SCANNED)
  for (let index = messages.length - 1; index >= stop && rows.length < MAX_ROWS; index--) {
    const row = inboundOf(messages[index])
    if (row) {
      rows.push(row)
    }
  }
  return rows.toReversed()
}

export function sameAgentHubMirrorInbound(
  a: readonly AgentHubMirrorInboundRow[],
  b: readonly AgentHubMirrorInboundRow[]
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (row, index) =>
        row.id === b[index].id && row.preview === b[index].preview && row.sender === b[index].sender
    )
  )
}
