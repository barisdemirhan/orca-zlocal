import type {
  CodexJournalTranslatorDeps,
  CodexJournalTranslationAdmission
} from './structured/journal/codex-structured-journal-contracts'
import { appendCodexItemAndPublish } from './structured/journal/codex-structured-journal-sink'
import {
  AGENT_JOURNAL_THREAD_SCOPE,
  type AgentJournalMessageItem
} from '../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentJournalItemIdentity } from '../../shared/agent-session/journal/agent-session-journal-identity'
import { estimateStructuredAgentSessionItemBytes } from '../native-chat/agent-session-wire/journal-ingress/structured-agent-session-event-sink-estimate'
import { CodexRealtimeTranscriptSchema } from './codex-structured-realtime-items'
import type { CodexStructuredSessionEvent } from './structured/session-lifecycle/codex-structured-session-state'

/** Only the provider's canonical commit makes a spoken message durable. */
export function appendCodexRealtimeTranscript(
  sink: CodexJournalTranslatorDeps['sink'],
  threadId: string,
  item: unknown
): CodexJournalTranslationAdmission {
  const parsed = CodexRealtimeTranscriptSchema.safeParse(item)
  if (!parsed.success) {
    return { accepted: true }
  }
  const transcript = parsed.data
  if (!transcript.text.trim()) {
    return { accepted: true }
  }
  const identity = {
    provider: 'orca',
    clientMessageId: `codex-realtime:${JSON.stringify([threadId, transcript.id])}`
  } satisfies AgentJournalItemIdentity
  const body = {
    kind: 'message',
    role: transcript.role,
    blocks: [{ type: 'text', text: transcript.text }],
    spoken: {
      provider: 'codex',
      threadId,
      realtimeSessionId: transcript.realtimeSessionId,
      itemId: transcript.id
    }
  } satisfies AgentJournalMessageItem
  const options = { turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  if (sink.tryReviseResolvedItemAndPublish) {
    return sink.tryReviseResolvedItemAndPublish(
      estimateStructuredAgentSessionItemBytes(identity, body),
      // turn-open writes only an absent row, so duplicate and replayed finals keep the first commit.
      { kind: 'turn-open', identity, body },
      options
    )
  }
  return appendCodexItemAndPublish(sink, identity, body, options)
}

export function translateCodexRealtimeJournalEvent(
  deps: CodexJournalTranslatorDeps,
  event: Exclude<CodexStructuredSessionEvent, { type: 'voice' }>
): CodexJournalTranslationAdmission | undefined {
  if (event.type !== 'notification' || !event.method.startsWith('thread/realtime/')) {
    return undefined
  }
  if (
    event.method !== 'thread/realtime/item/completed' ||
    event.threadId !== (deps.primaryThreadId?.() ?? null)
  ) {
    return { accepted: true }
  }
  const params = event.params
  return typeof params === 'object' && params !== null && 'item' in params
    ? appendCodexRealtimeTranscript(deps.sink, event.threadId, params.item)
    : { accepted: true }
}
