import {
  codexApprovalUsesTurnReviewer,
  codexTurnApprovalsAreAutoReviewed
} from './codex-subagent-reviewer'
import type { HookListenerState } from '../../listener-state'

/**
 * Drops a `PermissionRequest` wait that Codex's own review agent owns.
 *
 * Codex runs this hook as decider #1, ahead of both its review agent and the user, so the event
 * alone is "a decision is being made", not "a human is blocked". Under `approvals_reviewer =
 * auto_review` ("Approve for me") the review agent resolves it seconds later and the pane flapped
 * between Needs You and Working for every gated tool call (STA-7698).
 *
 * `request_user_input` is untouched: it arrives as `PreToolUse`, and no reviewer can answer a
 * question addressed to the user (#9861).
 */
export function resolveCodexApprovalOwnedState(
  state: HookListenerState,
  eventName: unknown,
  paneKey: string,
  transcriptPath: string | undefined,
  stateName: 'working' | 'waiting' | 'done',
  toolName: string | undefined
): 'working' | 'waiting' | 'done' {
  if (
    stateName !== 'waiting' ||
    eventName !== 'PermissionRequest' ||
    !codexApprovalUsesTurnReviewer(toolName)
  ) {
    return stateName
  }
  return codexTurnApprovalsAreAutoReviewed(
    state.codexSubagentTranscriptByPaneKey.get(paneKey),
    transcriptPath
  )
    ? 'working'
    : stateName
}
