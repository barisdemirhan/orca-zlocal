import type { ParsedAgentStatusPayload } from '../../../../agent-status/contracts/agent-status-types'
import type { HookListenerState } from '../../../listener-state'
import type { ClaudeLeadTurnState } from '../../../main-agent-turn-state'
import { setClaudeMainAgentTurnState } from './claude-roster-state'
import { resolveClaudePaneStatus } from './claude-pane-hold-evidence'
import { buildClaudeStatusPayload } from './claude-status-build'
import { buildClaudeCachedLeadStatusPayload } from './claude-lifecycle-events'

function restoreDisplacedClaudeLead(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>,
  waitingLead: ClaudeLeadTurnState
): ParsedAgentStatusPayload | null {
  const restored = setClaudeMainAgentTurnState(
    state,
    paneKey,
    waitingLead.stateBeforeWait ?? { state: 'working' as const }
  )
  return buildClaudeStatusPayload(state, eventName, promptText, paneKey, hookPayload, {
    ...resolveClaudePaneStatus(state, paneKey, restored),
    updateToolSnapshot: true
  })
}

// An answered MCP dialog restores the displaced state; a server can elicit outside any turn.
export function normalizeClaudeElicitationResult(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>,
  previousLead: ClaudeLeadTurnState | undefined,
  eventAgentId: string | undefined
): ParsedAgentStatusPayload | null {
  if (previousLead?.state !== 'waiting' || previousLead.waitingAgentId !== eventAgentId) {
    return null
  }
  return restoreDisplacedClaudeLead(
    state,
    eventName,
    promptText,
    paneKey,
    hookPayload,
    previousLead
  )
}

export function normalizeClaudeSubagentToolEvent(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>,
  subagentOriginId: string,
  eventToolUseId: string | undefined
): ParsedAgentStatusPayload | null {
  const lead = state.claudeLeadStateByPaneKey.get(paneKey)
  if (lead?.state !== 'waiting' || lead.waitingAgentId !== subagentOriginId) {
    return buildClaudeCachedLeadStatusPayload(state, eventName, paneKey, hookPayload, {
      workingChildEvidence: true
    })
  }
  const isParallelSiblingCompletionDuringChildQuestion =
    (eventName === 'PostToolUse' || eventName === 'PostToolUseFailure') &&
    lead.waitingToolUseId !== undefined &&
    eventToolUseId !== undefined &&
    eventToolUseId !== lead.waitingToolUseId
  if (isParallelSiblingCompletionDuringChildQuestion) {
    // Restating the wait would replace the prompt row a receiver holds against other agents.
    return null
  }
  // Approval clears the card and restores the displaced lead; inventing working cannot later fold back to done.
  return restoreDisplacedClaudeLead(state, eventName, promptText, paneKey, hookPayload, lead)
}
