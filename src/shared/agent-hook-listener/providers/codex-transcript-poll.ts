import { record } from '../../codex-rollout-jsonl-cursor'
import {
  hasPendingCodexSubagentIdentity,
  retryPendingCodexSubagentIdentities,
  upsertCodexSubagent
} from '../../codex-subagent-roster'
import {
  codexTranscriptTurnEnd,
  reconcileCodexSubagentTranscript
} from '../../codex-subagent-transcript'
import { normalizeHookPayload } from '../normalization/normalize-hook-payload'
import {
  codexTurnApprovalsAreAutoReviewed,
  reconcileCodexSubagentReviewer
} from '../../codex-subagent-reviewer'
import type { AgentHookEventPayload } from '../listener-event'
import type { HookListenerState } from '../listener-state'
import { resolveToolState } from '../prompt-fields'
import { buildCodexChildDrivenStatusPayload } from './codex-events'
import {
  getOrCreateCodexSubagentRoster,
  markCodexLeadTurnInterrupted,
  setCodexMainAgentTurnState
} from './codex-state'

/** Poll new host rollout records without replaying starting hooks; replay ended root turns as Stops skipped for internal subagents. */
export function pollCodexTranscriptStatus(
  state: HookListenerState,
  original: AgentHookEventPayload,
  body: unknown,
  env: string
): AgentHookEventPayload | undefined {
  const roster = getOrCreateCodexSubagentRoster(state, original.paneKey)
  const transcript = state.codexSubagentTranscriptByPaneKey.get(original.paneKey)
  if (!transcript?.parent.filePath) {
    const named = retryPendingCodexSubagentIdentities(roster)
    // Without a parent rollout, keep polling only while a child's own rollout still owes its name.
    const payload = named
      ? buildCodexChildDrivenStatusPayload(state, undefined, original.paneKey, {})
      : undefined
    if (payload) {
      return { ...original, hookEventName: undefined, payload }
    }
    return hasPendingCodexSubagentIdentity(roster) ? original : undefined
  }
  const reconciled = reconcileCodexSubagentTranscript(
    transcript,
    roster,
    transcript.parent.filePath
  )
  let changed = retryPendingCodexSubagentIdentities(roster) || reconciled
  for (const [agentId, path] of transcript.pendingApprovalPathsByAgentId) {
    const lead = state.codexLeadStateByPaneKey.get(original.paneKey)
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
    changed = true
    if (agentId) {
      upsertCodexSubagent(roster, agentId, { state: 'working' }, Date.now())
    } else {
      setCodexMainAgentTurnState(state, original.paneKey, { state: 'working', model: lead?.model })
      resolveToolState(state, original.paneKey, {}, { resetOnNewTurn: false })
    }
  }
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
    return normalizeHookPayload(state, 'codex', stop, env) ?? undefined
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
