import type { AgentStatusState } from '../agent-status/contracts/agent-status-types'
import type { AgentTurnOutcome } from '../agent-status/lifecycle/agent-turn-outcome'
import type { AgentTurnFailure } from '../agent-status/lifecycle/main-agent-status'

/** The Claude main agent's own turn record, published on every row as `mainAgent`. */
export type ClaudeLeadTurnState = {
  state: AgentStatusState
  /** A known background task opened this foreground finishing turn. */
  taskWakeupTurn?: true
  /** The recorded verdict on the turn this record closed (the provider's, or a `cancellation`
   *  Orca inferred from the interrupt keystroke, or whatever a persisted row it was seeded from
   *  held); only meaningful while `state` is done. `cancellation` is what the fold reads as an
   *  interrupt. */
  outcome?: AgentTurnOutcome
  /** On a `failure` outcome: Claude's StopFailure `error` (`rate_limit`) and its message. */
  failure?: AgentTurnFailure
  /** When `state` first appeared; the main agent's own clock, distinct from the gated row's. */
  stateStartedAt: number
  /** Subagent that induced the wait; only its next tool activity may clear it, so other children's churn can't dismiss a pending human-input card. */
  waitingAgentId?: string
  /** Tool call that owns the wait; late completions from parallel sibling tools must not dismiss its card. */
  waitingToolUseId?: string
  waitingHumanPrompt?: {
    kind: 'permission_prompt' | 'elicitation_dialog'
    sessionId?: string
    serverName?: string
    elicitationId?: string
  }
  /** End time of the main agent turn closed while background inventory kept the pane `working`. Repeated on the later all-clear `done`. */
  turnCompletedAt?: number
  /** That end time, held because the turn's late prompt event has not said whether a task wakeup started it. */
  unclassifiedTurnCompletedAt?: number
  /** Claude hook model. Later events that omit it keep the last reported value. */
  model?: string
  /** Restore the lead state displaced by a child wait; inventing working cannot later fold back to done. */
  stateBeforeWait?: Pick<
    ClaudeLeadTurnState,
    'state' | 'outcome' | 'failure' | 'stateStartedAt' | 'turnCompletedAt' | 'taskWakeupTurn'
  >
}

/** When the main agent's own turn last ended, while it has not started another. */
export function mainAgentIdleSince(
  record: Pick<ClaudeLeadTurnState, 'state' | 'stateStartedAt'> | undefined
): number | undefined {
  return record?.state === 'done' ? record.stateStartedAt : undefined
}

/** Root-only Codex state; child waits live on roster entries and affect only the combined fold. */
export type CodexLeadTurnState = {
  state: 'working' | 'waiting' | 'done'
  /** Inferred/persisted verdict; Codex Stop carries none. */
  outcome?: AgentTurnOutcome
  /** When `state` first appeared; the root's own clock, published as `mainAgent.stateStartedAt`. */
  stateStartedAt: number
  model?: string
  /** Execution-host-only identity of the root session and turn whose rollout end can be replayed as Stop. */
  sessionId?: string
  turnId?: string
}
