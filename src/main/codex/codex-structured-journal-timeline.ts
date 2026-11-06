import type {
  CodexJournalTranslator,
  CodexJournalTranslatorDeps,
  CodexJournalTranslationAdmission
} from './structured/journal/codex-structured-journal-contracts'
import { appendCodexRealtimeTranscript } from './codex-structured-realtime-transcript'
import type { CodexTimelineEntry } from './codex-structured-realtime-timeline'
import {
  historicalTurnLifecycle,
  restoreCodexHistoryItem
} from './structured/journal/codex-structured-journal-translation-restore'
import { publishCodexTurnLifecycle } from './structured/journal/codex-structured-journal-translation-turns'
import type { CodexJournalItems } from './structured/journal/codex-structured-journal-items'
import type { CodexJournalCompactions } from './structured/journal/codex-structured-journal-compactions'
import type { CodexSubagentExecutions } from './structured/background-work/codex-subagent-executions'

export function createCodexJournalHistoryRestorer(input: {
  deps: CodexJournalTranslatorDeps
  items: CodexJournalItems
  compactions: CodexJournalCompactions
  executions: CodexSubagentExecutions
}) {
  const restoreItem = (event: Parameters<typeof restoreCodexHistoryItem>[0]) =>
    restoreCodexHistoryItem(event, {
      primaryThreadId: input.deps.primaryThreadId?.() ?? null,
      items: input.items,
      compactions: input.compactions,
      executions: input.executions
    })
  const restoreTimeline: NonNullable<CodexJournalTranslator['restoreTimeline']> = (
    threadId,
    entries,
    realtimeOnly = false
  ) =>
    restoreCodexCanonicalTimeline({
      deps: input.deps,
      threadId,
      entries,
      realtimeOnly,
      resetTurnOrdinals: (turnId) => input.items.ordinals.forgetTurn(threadId, turnId),
      restoreItem
    })
  return { restoreTimeline, restoreItem }
}

export function restoreCodexCanonicalTimeline(input: {
  deps: CodexJournalTranslatorDeps
  threadId: string
  entries: readonly CodexTimelineEntry[]
  realtimeOnly: boolean
  resetTurnOrdinals: (turnId: string) => void
  restoreItem: (event: {
    threadId: string
    method: string
    params: unknown
  }) => CodexJournalTranslationAdmission
}): CodexJournalTranslationAdmission {
  const { deps, threadId, entries } = input
  const completions = new Map(
    entries.flatMap((entry) =>
      entry.type === 'turnCompleted' ? [[entry.turn_id, entry] as const] : []
    )
  )
  if (!input.realtimeOnly) {
    for (const turnId of new Set(
      entries.flatMap((entry) => (entry.type === 'item' ? [entry.turnId] : []))
    )) {
      input.resetTurnOrdinals(turnId)
    }
  }
  for (const entry of entries) {
    let admission: CodexJournalTranslationAdmission = { accepted: true }
    if (entry.type === 'realtime') {
      admission = appendCodexRealtimeTranscript(deps.sink, threadId, entry.item)
    } else if (!input.realtimeOnly && entry.type === 'item') {
      admission = input.restoreItem({
        threadId,
        method: 'item/completed',
        params: { turnId: entry.turnId, item: entry.item }
      })
    } else if (!input.realtimeOnly && entry.type === 'turnStarted' && deps.sessionId) {
      const complete = completions.get(entry.turn_id)
      const lifecycle =
        complete &&
        historicalTurnLifecycle(threadId, {
          id: entry.turn_id,
          startedAt: entry.started_at ?? complete.started_at,
          completedAt: complete.completed_at,
          durationMs: complete.duration_ms,
          status: complete.status
        })
      if (lifecycle) {
        admission = publishCodexTurnLifecycle({
          sink: deps.sink,
          primaryThreadId: threadId,
          sessionId: deps.sessionId,
          threadId,
          ...lifecycle
        })
      }
    }
    if (!admission.accepted) {
      return admission
    }
  }
  return { accepted: true }
}
