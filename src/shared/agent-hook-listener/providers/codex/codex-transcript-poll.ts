import { RolloutReadBatch } from './codex-rollout-async-reads'
import { record } from './codex-rollout-jsonl-format'
import {
  createPrefetchedRolloutReads,
  withPrefetchedRolloutReads
} from './codex-rollout-prefetch-scope'
import {
  hasPendingCodexSubagentIdentity,
  upsertCodexSubagent,
  type CodexSubagentRoster
} from './codex-subagent-roster'
import {
  applyPendingCodexSubagentIdentities,
  readPendingCodexSubagentIdentities,
  type CodexSubagentIdentityRead
} from './codex-subagent-identity-reads'
import {
  applyCodexSubagentTranscriptReads,
  readCodexSubagentTranscript,
  type CodexSubagentTranscriptReads
} from './codex-subagent-transcript-reads'
import {
  codexTranscriptTurnEnd,
  type CodexSubagentTranscriptState
} from './codex-subagent-transcript'
import { normalizeHookPayload } from '../../normalization/normalize-hook-payload'
import {
  codexTurnApprovalsAreAutoReviewed,
  reconcileCodexSubagentReviewer
} from './codex-subagent-reviewer'
import type { AgentHookEventPayload } from '../../listener-event'
import type { HookListenerState } from '../../listener-state'
import { resolveToolState } from '../../prompt-fields'
import { buildCodexChildDrivenStatusPayload } from './codex-events'
import {
  getOrCreateCodexSubagentRoster,
  markCodexLeadTurnInterrupted,
  setCodexMainAgentTurnState
} from './codex-state'

export type CodexTranscriptPollReads = {
  /** Holds the read buffers' share of the budget; callers release it once the reads are applied or dropped. */
  batch: RolloutReadBatch
  roster?: CodexSubagentRoster
  transcript?: CodexSubagentTranscriptState
  transcriptReads?: CodexSubagentTranscriptReads
  identities: CodexSubagentIdentityRead[]
}

/** Reads the pane's rollouts off the main thread; slow opens (Windows on-access scans) must never block it. */
export async function readCodexTranscriptPoll(
  state: HookListenerState,
  paneKey: string
): Promise<CodexTranscriptPollReads> {
  const roster = state.codexSubagentRosterByPaneKey.get(paneKey)
  const transcript = state.codexSubagentTranscriptByPaneKey.get(paneKey)
  // A replaced or cleared pane makes the rest of these reads unappliable; stop opening rollouts for it.
  const batch = new RolloutReadBatch(
    () =>
      state.codexSubagentRosterByPaneKey.get(paneKey) === roster &&
      state.codexSubagentTranscriptByPaneKey.get(paneKey) === transcript
  )
  try {
    const transcriptReads = transcript?.parent.filePath
      ? await readCodexSubagentTranscript(transcript, batch)
      : undefined
    return {
      batch,
      roster,
      transcript,
      transcriptReads,
      identities: roster ? await readPendingCodexSubagentIdentities(roster, batch) : []
    }
  } catch (error) {
    // Callers release on success; a rejected read must not keep its share of the budget.
    batch.release()
    throw error
  }
}

/** Apply polled rollout records without replaying starting hooks; replay ended root turns as Stops skipped for internal subagents. Callers apply only while `original` is still the pane's row. */
export function pollCodexTranscriptStatus(
  state: HookListenerState,
  original: AgentHookEventPayload,
  body: unknown,
  env: string,
  reads: CodexTranscriptPollReads
): AgentHookEventPayload | undefined {
  const roster = getOrCreateCodexSubagentRoster(state, original.paneKey)
  const transcript = state.codexSubagentTranscriptByPaneKey.get(original.paneKey)
  const applyIdentities = (): boolean =>
    reads.roster === roster && applyPendingCodexSubagentIdentities(roster, reads.identities)
  if (!transcript?.parent.filePath) {
    const named = applyIdentities()
    const settled = transcript
      ? settlePendingCodexApprovals(state, original.paneKey, transcript, roster)
      : false
    // Without a parent rollout, keep polling only while a child's rollout owes its name or reviewer.
    const payload =
      named || settled
        ? buildCodexChildDrivenStatusPayload(state, undefined, original.paneKey, {})
        : undefined
    if (payload) {
      return { ...original, hookEventName: undefined, payload }
    }
    return hasPendingCodexSubagentIdentity(roster) || transcript?.pendingApprovalPathsByAgentId.size
      ? original
      : undefined
  }
  const reconciled =
    reads.transcript === transcript && reads.transcriptReads !== undefined
      ? applyCodexSubagentTranscriptReads(transcript, roster, reads.transcriptReads)
      : false
  let changed = applyIdentities() || reconciled
  changed = settlePendingCodexApprovals(state, original.paneKey, transcript, roster) || changed
  const lead = state.codexLeadStateByPaneKey.get(original.paneKey)
  const interrupted = transcript.rootTurn.interrupted && lead?.state !== 'done'
  const envelope = record(body)
  if (
    !interrupted &&
    envelope &&
    transcript.parent.filePath &&
    lead?.turnId &&
    lead.state !== 'done' &&
    codexTranscriptTurnEnd(transcript, lead.turnId)
  ) {
    const stop = {
      ...envelope,
      hook_event_name: undefined,
      hookEventName: undefined,
      payload: {
        hook_event_name: 'Stop',
        ...(lead.sessionId ? { session_id: lead.sessionId } : {}),
        turn_id: lead.turnId,
        transcript_path: transcript.parent.filePath
      }
    }
    // The poll just read this rollout; its replayed Stop must not reopen it on the main thread.
    return (
      withPrefetchedRolloutReads(createPrefetchedRolloutReads(), () =>
        normalizeHookPayload(state, 'codex', stop, env)
      ) ?? undefined
    )
  }
  if (!changed && !interrupted) {
    return original
  }
  if (interrupted) {
    markCodexLeadTurnInterrupted(state, original.paneKey)
  }
  const payload = buildCodexChildDrivenStatusPayload(state, undefined, original.paneKey, {})
  // Why: only a replayed Stop may carry an event name; this row restates the last hook's.
  return payload ? { ...original, hookEventName: undefined, payload } : undefined
}

function settlePendingCodexApprovals(
  state: HookListenerState,
  paneKey: string,
  transcript: CodexSubagentTranscriptState,
  roster: ReturnType<typeof getOrCreateCodexSubagentRoster>
): boolean {
  let settled = false
  for (const [agentId, path] of transcript.pendingApprovalPathsByAgentId) {
    const lead = state.codexLeadStateByPaneKey.get(paneKey)
    const pendingState = agentId ? roster.get(agentId)?.state : lead?.state
    if (pendingState !== 'waiting') {
      transcript.pendingApprovalPathsByAgentId.delete(agentId)
      continue
    }
    if (path !== transcript.parent.filePath) {
      reconcileCodexSubagentReviewer(transcript, path)
    }
    if (!codexTurnApprovalsAreAutoReviewed(transcript, path)) {
      continue
    }
    transcript.pendingApprovalPathsByAgentId.delete(agentId)
    settled = true
    if (agentId) {
      upsertCodexSubagent(roster, agentId, { state: 'working' }, Date.now())
    } else {
      setCodexMainAgentTurnState(state, paneKey, { state: 'working', model: lead?.model })
      resolveToolState(state, paneKey, {}, { resetOnNewTurn: false })
    }
  }
  return settled
}
