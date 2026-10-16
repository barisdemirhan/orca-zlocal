import type { AgentSessionAccountKind } from '../../shared/agent-session-availability'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import type { CodexDispatchEchoes } from './codex-structured-dispatch-echo'
import {
  createCodexJournalTranslator,
  type CodexJournalTranslator
} from './codex-structured-journal-translation'
import type { CodexOpenedThread } from './codex-structured-thread-open'
import type { CodexAppServerConnection } from './codex-app-server-connection'
import { readCodexRealtimeTimeline } from './codex-structured-realtime-timeline'
import { AgentSessionAcquisitionRefusal } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { CodexSubagentExecutions } from './codex-subagent-executions'
import type {
  CodexAcquisitionAttempt,
  CodexStructuredSessionAdapterDeps
} from './codex-structured-session-state'

export async function restoreAcquiredCodexJournal(input: {
  connection: CodexAppServerConnection
  opened: CodexOpenedThread
  translator: CodexJournalTranslator | null
  resumed: boolean
  timeoutMs?: number
  beforeRestore: () => void
}): Promise<boolean> {
  const { connection, opened, translator } = input
  const timeline =
    input.resumed && translator
      ? await readCodexRealtimeTimeline(connection, opened.threadId, input.timeoutMs)
      : null
  input.beforeRestore()
  const admission =
    timeline?.status === 'ready' && translator?.restoreTimeline
      ? translator.restoreTimeline(opened.threadId, timeline.entries)
      : translator?.restoreThread(opened.threadId, opened.thread ?? {})
  if (admission && !admission.accepted) {
    throw AgentSessionAcquisitionRefusal.historyTooLarge(
      'Codex thread history exceeds the bounded restore queue; history was not partially imported.'
    )
  }
  return timeline?.status === 'ready' && admission?.accepted === true
}

export function createCodexSessionJournalTranslator(input: {
  sink: StructuredAgentSessionEventSink | undefined
  account: () => AgentSessionAccountKind | undefined
  sessionId: string
  acquisitionId: string
  deps: CodexStructuredSessionAdapterDeps
  primaryThreadId: () => string | null
  dispatchEchoes: CodexDispatchEchoes
  subagentExecutions: CodexSubagentExecutions
  prompts: CodexAcquisitionAttempt['window']['prompts']
}) {
  const { sink, account, sessionId, acquisitionId, deps, dispatchEchoes, prompts } = input
  return sink
    ? createCodexJournalTranslator({
        sink,
        account,
        sessionId,
        acquisitionId,
        ...(deps.now ? { now: deps.now } : {}),
        primaryThreadId: input.primaryThreadId,
        dispatchRequestOrigin: (clientMessageId) => dispatchEchoes.requestOrigin(clientMessageId),
        subagentExecutions: input.subagentExecutions,
        bindPromptItemId: (journalItemId, threadId, promptKey, turnId) =>
          prompts.bindJournalItemId(journalItemId, threadId, promptKey, turnId),
        clearPromptTurn: (threadId, turnId) => prompts.clearTurn(threadId, turnId),
        onUserMessageEcho: (clientMessageId, providerIdentity) => {
          // Duplicate exact echoes retry receipt persistence while the send remains unsettled.
          dispatchEchoes.settle(clientMessageId)
          deps.onDispatchSettledLate?.({ sessionId, clientMessageId, providerIdentity })
        }
      })
    : null
}
