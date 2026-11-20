import type { ParsedAgentStatusPayload } from '../../../agent-status/contracts/agent-status-types'
import { isAskUserQuestionTool } from '../../../agent-status/lifecycle/agent-question-answered-intent'
import { readClaudeBackgroundAgentTasks } from './background-tasks/claude-background-task-inventory'
import {
  claudeRosterHasRestoredSnapshotSubagent,
  claudeRosterHasRuntimeWorkingSubagent,
  foldClaudeBackgroundTasksIntoRoster,
  isClaudeChildTurnEndEvent,
  upsertWorkingClaudeSubagent
} from './lifecycle/claude-subagent-roster'
import type { HookListenerState } from '../../listener-state'
import type { ClaudeLeadTurnState } from '../../main-agent-turn-state'
import { readFirstString } from '../../interactive-tool'
import { shouldIgnoreCompactContinuationUserPromptSubmit } from '../../prompt-fields'
import { readString } from '../../tool-input-preview'
import { readClaudeLeadEventModel } from './transcripts/claude-transcript-model'
import {
  buildClaudeCachedLeadStatusPayload,
  normalizeClaudeSubagentLifecycleEvent
} from './lifecycle/claude-lifecycle-events'
import {
  getOrCreateClaudeSubagentRoster,
  setClaudeMainAgentTurnState,
  updateClaudeRunningNonAgentTask,
  voidClaimsOfReplacedClaudeSession
} from './lifecycle/claude-roster-state'
import {
  resolveClaudePaneStatus,
  claudeRowHasUnlistedLiveWork
} from './lifecycle/claude-pane-hold-evidence'
import {
  holdClaudeLeadBeneathChildHumanWait,
  readClaudeChildHumanWait,
  resolveClaudeStateBeforeWait
} from './lifecycle/claude-child-human-wait'
import {
  normalizeClaudeElicitationResult,
  normalizeClaudeSubagentToolEvent
} from './lifecycle/claude-displaced-lead-restore'
import { trackClaudeSessionCronInventory } from './lifecycle/claude-session-cron-tracking'
import { reapRestoredClaudeSubagentsOnManualCompact } from './lifecycle/claude-pane-gate-reset'
import { buildClaudeStatusPayload } from './lifecycle/claude-status-build'
import { claudeWaitRequest, settleClaudeToolBatch } from './lifecycle/claude-tool-request-wait'
import { trackClaudeTaskNotificationDelivery } from './background-tasks/claude-task-notification-delivery'
import { normalizeClaudeHumanNotification } from './claude-human-notifications'
import { recordClaudeTeammateSpawn } from './lifecycle/claude-teammate-spawn'
import { settleLateClaudePromptSubmit } from './lifecycle/claude-late-prompt-submit'
import { CLAUDE_LATE_PROMPT_SUBMIT_EVENT } from './lifecycle/claude-prompt-turn-order'
import { claudeHeldTurnEnd } from './lifecycle/claude-held-turn-end'
import { normalizeClaudeSessionStart } from './lifecycle/claude-session-start-event'
import { isClaudeToolEvent, restatePluginToolCall } from './lifecycle/claude-tool-events'

const CLAUDE_HOOK_AGENT_ID_PREFIX = 'hook-agent-'

export function normalizeClaudeEvent(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>,
  opensTurn = false
): ParsedAgentStatusPayload | null {
  const eventAgentId = readString(hookPayload, 'agent_id')
  voidClaimsOfReplacedClaudeSession(state, eventName, eventAgentId, paneKey, hookPayload)
  const humanNotification = normalizeClaudeHumanNotification(state, eventName, paneKey, hookPayload)
  if (humanNotification !== undefined) {
    return humanNotification
  }
  if (
    eventName === 'SubagentStart' ||
    eventName === 'TeammateIdle' ||
    isClaudeChildTurnEndEvent(eventName, eventAgentId)
  ) {
    return normalizeClaudeSubagentLifecycleEvent(state, eventName, paneKey, hookPayload)
  }
  const leadModel =
    eventAgentId === undefined ? readClaudeLeadEventModel(eventName, hookPayload) : undefined
  if (eventName === CLAUDE_LATE_PROMPT_SUBMIT_EVENT) {
    return settleLateClaudePromptSubmit(state, promptText, paneKey, hookPayload)
  }
  if (eventName === 'SessionStart') {
    return normalizeClaudeSessionStart(
      state,
      promptText,
      paneKey,
      hookPayload,
      eventAgentId,
      leadModel
    )
  }
  const previousLead = state.claudeLeadStateByPaneKey.get(paneKey)
  const childHumanWait = readClaudeChildHumanWait(previousLead, eventAgentId)
  const previousTurn = childHumanWait ? childHumanWait.stateBeforeWait : previousLead
  // Why: only a turn boundary may declare a verdict or carry a prior cancellation forward; any
  // other event starts a fresh turn and drops it. The verdict is a fact about the main agent's turn and
  // nothing else: a cancel never touches the shell, cron or subagent the turn left running.
  const isTurnBoundary = eventName === 'Stop' || eventName === 'StopFailure'
  // Why: absent means unknown — a plain Stop never becomes `success`, so a cancel can never read as a
  // success. Current Claude sends NO hook on a cancel and no `is_interrupt` on Stop, so the
  // cancellation normally arrives through Orca's own inferred interrupt
  // (`markClaudeLeadTurnInterrupted`) and is carried forward here; `is_interrupt` on a turn
  // boundary is kept as the secondary source for builds that do send it.
  const outcome = !isTurnBoundary
    ? undefined
    : (eventAgentId === undefined && hookPayload['is_interrupt'] === true) ||
        (!opensTurn && previousTurn?.outcome === 'cancellation')
      ? ('cancellation' as const)
      : eventName === 'StopFailure'
        ? ('failure' as const)
        : undefined
  const backgroundTasks = readClaudeBackgroundAgentTasks(hookPayload)
  const isTaskWakeup =
    eventAgentId === undefined &&
    trackClaudeTaskNotificationDelivery(state, paneKey, eventName, hookPayload, backgroundTasks)
  if (eventName === 'PostToolUse' && eventAgentId === undefined) {
    recordClaudeTeammateSpawn(state, paneKey, hookPayload)
  }
  const sessionCrons = hookPayload['session_crons']
  const sessionCronInventoryPresent = Array.isArray(sessionCrons)
  const hasActiveSessionCron = sessionCronInventoryPresent && sessionCrons.length > 0

  if (shouldIgnoreCompactContinuationUserPromptSubmit(eventName, promptText)) {
    return null
  }

  // AskUserQuestion blocks on PreToolUse as well as PermissionRequest; both need human attention.
  const eventToolName = readString(hookPayload, 'tool_name')
  const isAskUserQuestionWait =
    (eventName === 'PreToolUse' || eventName === 'PermissionRequest') &&
    isAskUserQuestionTool(eventToolName)
  const isAskUserQuestion = eventName === 'PreToolUse' && isAskUserQuestionWait
  // Why: plugins can call tools after Stop (#43998); the event stays accepted for tool hooks but does not change status.
  const restated = restatePluginToolCall(state, eventName, paneKey, hookPayload, isAskUserQuestion)
  if (restated) {
    return restated
  }
  // Manual PostCompact ends at idle without Stop; auto compaction stays in-turn, and PreCompact alone can be aborted (STA-2915).
  const isManualCompactCompletion = eventName === 'PostCompact' && hookPayload.trigger === 'manual'
  if (eventName === 'ElicitationResult') {
    return normalizeClaudeElicitationResult(
      state,
      eventName,
      promptText,
      paneKey,
      hookPayload,
      previousLead,
      eventAgentId
    )
  }
  if (eventName === 'PostToolBatch') {
    return settleClaudeToolBatch(state, eventName, promptText, paneKey, hookPayload, eventAgentId)
  }
  const reportedStateName =
    eventName === 'UserPromptSubmit' ||
    eventName === 'PostToolUse' ||
    eventName === 'PostToolUseFailure' ||
    (eventName === 'PreToolUse' && !isAskUserQuestion)
      ? 'working'
      : eventName === 'PermissionRequest' || eventName === 'Elicitation' || isAskUserQuestion
        ? 'waiting'
        : isTurnBoundary || isManualCompactCompletion
          ? 'done'
          : null

  if (!reportedStateName) {
    return null
  }
  if (backgroundTasks.present && eventAgentId === undefined) {
    updateClaudeRunningNonAgentTask(state, paneKey, backgroundTasks.hasRunningNonAgentTask)
  }
  if (eventAgentId === undefined) {
    trackClaudeSessionCronInventory(
      state,
      paneKey,
      { present: sessionCronInventoryPresent, active: hasActiveSessionCron },
      isTurnBoundary && backgroundTasks.present
    )
  }

  const eventToolUseId = readFirstString(hookPayload, ['tool_use_id', 'toolUseId'])
  const previousTool = state.lastToolByPaneKey.get(paneKey)
  const isParallelSiblingCompletionDuringQuestion =
    eventAgentId === undefined &&
    previousLead?.state === 'waiting' &&
    isAskUserQuestionTool(previousTool?.toolName) &&
    (eventName === 'PostToolUse' || eventName === 'PostToolUseFailure') &&
    previousLead.waitingToolUseId !== undefined &&
    eventToolUseId !== undefined &&
    eventToolUseId !== previousLead.waitingToolUseId
  if (isParallelSiblingCompletionDuringQuestion) {
    return buildClaudeCachedLeadStatusPayload(state, eventName, paneKey, hookPayload)
  }

  // Child tools update their roster only, except child-induced waits and that child's next activity clearing its wait.
  const isWaitingInducing = reportedStateName === 'waiting'
  const subagentOriginId =
    !isWaitingInducing && isClaudeToolEvent(eventName) ? eventAgentId : undefined
  // Why: `"type": "agent"` hook runs emit tool hooks (agent_type only if inherited) but never SubagentStop, so their row would stay working forever; real children may be untyped and start-less.
  const isClaudeHookAgent = eventAgentId?.startsWith(CLAUDE_HOOK_AGENT_ID_PREFIX) === true
  if (eventAgentId && (subagentOriginId || isWaitingInducing) && !isClaudeHookAgent) {
    upsertWorkingClaudeSubagent(
      getOrCreateClaudeSubagentRoster(state, paneKey),
      eventAgentId,
      { agentType: readString(hookPayload, 'agent_type') },
      Date.now()
    )
  }
  if (subagentOriginId) {
    return normalizeClaudeSubagentToolEvent(
      state,
      eventName,
      promptText,
      paneKey,
      hookPayload,
      subagentOriginId,
      eventToolUseId
    )
  }

  // Even untracked children cannot own lead state/background evidence.
  if (eventAgentId && !isWaitingInducing) {
    return buildClaudeCachedLeadStatusPayload(state, eventName, paneKey, hookPayload, {
      workingChildEvidence: claudeRosterHasRuntimeWorkingSubagent(
        state.claudeSubagentRosterByPaneKey.get(paneKey)
      )
    })
  }

  if (isTurnBoundary && eventAgentId === undefined) {
    // Teammates can report running while idle; trust only unambiguous background_tasks entries and retain tracking for older builds.
    if (backgroundTasks.present) {
      foldClaudeBackgroundTasksIntoRoster(
        getOrCreateClaudeSubagentRoster(state, paneKey),
        backgroundTasks.tasks,
        Date.now(),
        { inventoryComplete: !backgroundTasks.truncated }
      )
    }
  }
  // Preserve the original lead stash through multiple child waits.
  const stateBeforeWait = resolveClaudeStateBeforeWait(
    eventName,
    eventAgentId,
    isWaitingInducing,
    previousLead
  )

  if (isManualCompactCompletion) {
    // Manual compact invalidates snapshot-only child liveness; confirmed children/shells/crons still hold the pane (STA-2915).
    reapRestoredClaudeSubagentsOnManualCompact(state, paneKey)
  }

  const taskWakeupTurn =
    eventName === 'UserPromptSubmit'
      ? isTaskWakeup
      : !opensTurn &&
        !isTurnBoundary &&
        !isManualCompactCompletion &&
        previousTurn?.taskWakeupTurn === true
  const resolvedStatus = resolveClaudePaneStatus(state, paneKey, {
    state: reportedStateName,
    ...(taskWakeupTurn ? { taskWakeupTurn: true as const } : {})
  })
  // Reuse resolved state for compact ownership instead of folding twice (#15202).
  const effectiveState = resolvedStatus.stateName
  const ownPreviousLead = previousLead?.waitingAgentId ? previousLead.stateBeforeWait : previousLead
  const heldEnd =
    eventAgentId === undefined && isTurnBoundary
      ? claudeHeldTurnEnd(state, paneKey, {
          resolvedStatus,
          outcome,
          selfStarted: ownPreviousLead?.taskWakeupTurn === true
        })
      : {}

  const nextLead: Omit<ClaudeLeadTurnState, 'stateStartedAt'> = {
    state: reportedStateName,
    ...(taskWakeupTurn ? { taskWakeupTurn: true as const } : {}),
    ...(outcome ? { outcome } : {}),
    ...(isWaitingInducing && eventAgentId ? { waitingAgentId: eventAgentId } : {}),
    ...claudeWaitRequest(eventName, isAskUserQuestionWait, eventToolUseId, previousLead),
    ...(stateBeforeWait ? { stateBeforeWait } : {}),
    ...heldEnd,
    model: leadModel
  }
  if (childHumanWait && !isWaitingInducing) {
    return holdClaudeLeadBeneathChildHumanWait(
      state,
      eventName,
      promptText,
      paneKey,
      hookPayload,
      childHumanWait,
      previousTurn,
      nextLead
    )
  }
  setClaudeMainAgentTurnState(state, paneKey, nextLead)

  const effectiveRoster = state.claudeSubagentRosterByPaneKey.get(paneKey)
  if (
    isTurnBoundary &&
    eventAgentId === undefined &&
    resolvedStatus.stateName === 'working' &&
    claudeRosterHasRestoredSnapshotSubagent(effectiveRoster) &&
    !claudeRosterHasRuntimeWorkingSubagent(effectiveRoster) &&
    !claudeRowHasUnlistedLiveWork(state, paneKey)
  ) {
    // Legacy/partial Stop confirms lead only; snapshot children remain unconfirmed.
    state.claudeUnconfirmedRestoredStatusPaneKeys.add(paneKey)
  }

  if (isManualCompactCompletion && effectiveState !== 'done') {
    // Compact clears or stays silent; live work must not gain a fresh clock or lose restoredUnconfirmed from an unrelated compact.
    return null
  }

  return buildClaudeStatusPayload(state, eventName, promptText, paneKey, hookPayload, {
    ...resolvedStatus,
    updateToolSnapshot: true,
    opensTurn,
    // Compact is a session boundary, never work eligible for completion notifications/automation.
    sessionBoundary: isManualCompactCompletion ? true : undefined
  })
}
