import type { ParsedAgentStatusPayload } from '../../../../agent-status/contracts/agent-status-types'
import { continueMainAgentStatus } from '../../../../agent-status/lifecycle/agent-lead-status-fold'
import type { HookListenerState } from '../../../listener-state'
import type { ClaudeLeadTurnState } from '../../../main-agent-turn-state'
import { setClaudeMainAgentTurnState } from './claude-roster-state'
import { resolveClaudePaneStatus } from './claude-pane-hold-evidence'
import { buildClaudeStatusPayload } from './claude-status-build'

export function readClaudeChildHumanWait(
  previousLead: ClaudeLeadTurnState | undefined,
  eventAgentId: string | undefined
): ClaudeLeadTurnState | undefined {
  return eventAgentId === undefined &&
    previousLead?.state === 'waiting' &&
    previousLead.waitingHumanPrompt &&
    previousLead.waitingAgentId
    ? previousLead
    : undefined
}

export function holdClaudeLeadBeneathChildHumanWait(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>,
  childHumanWait: ClaudeLeadTurnState,
  previousTurn: ClaudeLeadTurnState | Required<ClaudeLeadTurnState>['stateBeforeWait'] | undefined,
  nextLead: Omit<ClaudeLeadTurnState, 'stateStartedAt'>
): ParsedAgentStatusPayload | null {
  // The main turn advances beneath a child's still-visible form.
  const heldLead = setClaudeMainAgentTurnState(state, paneKey, {
    ...childHumanWait,
    stateBeforeWait: {
      ...nextLead,
      ...continueMainAgentStatus(previousTurn, nextLead, Date.now())
    }
  })
  return buildClaudeStatusPayload(state, eventName, promptText, paneKey, hookPayload, {
    ...resolveClaudePaneStatus(state, paneKey, heldLead),
    updateToolSnapshot: false
  })
}

export function resolveClaudeStateBeforeWait(
  eventName: unknown,
  eventAgentId: string | undefined,
  isWaitingInducing: boolean,
  previousLead: ClaudeLeadTurnState | undefined
): ClaudeLeadTurnState['stateBeforeWait'] {
  // Without a lead record there is no turn to resume; an answered dialog must not invent work.
  if (eventName === 'Elicitation' && !previousLead) {
    return { state: 'done' as const, stateStartedAt: Date.now() }
  }
  if (!(isWaitingInducing && (eventAgentId || eventName === 'Elicitation') && previousLead)) {
    return undefined
  }
  if (previousLead.state === 'waiting') {
    return previousLead.stateBeforeWait
  }
  return {
    state: previousLead.state,
    // Child waits must retain the lead's verdict and clock.
    ...(previousLead.outcome ? { outcome: previousLead.outcome } : {}),
    stateStartedAt: previousLead.stateStartedAt,
    ...(previousLead.taskWakeupTurn ? { taskWakeupTurn: true as const } : {}),
    // Keep the displaced lead end time so later child drain belongs to the same turn.
    ...(previousLead.turnCompletedAt !== undefined
      ? { turnCompletedAt: previousLead.turnCompletedAt }
      : {})
  }
}
