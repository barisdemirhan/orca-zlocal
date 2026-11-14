import type { ParsedAgentStatusPayload } from '../../../agent-status/contracts/agent-status-types'
import {
  claudeTeammateIdMatchesName,
  upsertWorkingClaudeSubagent
} from '../../../claude-subagent-roster'
import type { HookListenerState } from '../../listener-state'
import { clearActiveToolFieldsUpdate, readFirstString } from '../../interactive-tool'
import { resolveToolState } from '../../prompt-fields'
import { readString } from '../../tool-input-preview'
import { deletePaneScopedCacheEntry } from '../../pane-scoped-cache-entries'
import { buildClaudeCachedLeadStatusPayload } from './lifecycle/claude-lifecycle-events'
import {
  getOrCreateClaudeSubagentRoster,
  setClaudeMainAgentTurnState
} from './lifecycle/claude-roster-state'

export type ClaudeHumanPromptContext = {
  sessionId?: string
  activeToolIds: Set<string>
  elicitation?: { serverName: string; elicitationId?: string }
  permissionWithoutActiveTool?: boolean
}

/** Only visible notifications claim a wait; Elicitation hooks may be answered by another hook. */
export function normalizeClaudeHumanNotification(
  state: HookListenerState,
  eventName: unknown,
  paneKey: string,
  payload: Record<string, unknown>
): ParsedAgentStatusPayload | null | undefined {
  const agentId = readString(payload, 'agent_id')
  const key = agentId ? `${paneKey}\0${agentId}` : paneKey
  const sessionId = readString(payload, 'session_id')
  const contexts = state.claudeHumanPromptContextByPaneKey
  if (
    eventName === 'SessionStart' &&
    !agentId &&
    ['startup', 'resume', 'clear'].includes(String(payload.source))
  ) {
    deletePaneScopedCacheEntry(contexts, paneKey)
    return undefined
  }
  if (eventName === 'UserPromptSubmit') {
    contexts.delete(key)
    return undefined
  }
  if (eventName === 'TeammateIdle') {
    const name = readString(payload, 'teammate_name')
    if (name) {
      for (const contextKey of contexts.keys()) {
        if (
          contextKey.startsWith(`${paneKey}\0`) &&
          claudeTeammateIdMatchesName(contextKey.slice(paneKey.length + 1), name)
        ) {
          contexts.delete(contextKey)
        }
      }
    }
    return undefined
  }
  if (eventName === 'SubagentStop' || eventName === 'StopFailure' || eventName === 'Stop') {
    contexts.delete(key)
    return undefined
  }
  const isPreTool = eventName === 'PreToolUse'
  const isPostTool = eventName === 'PostToolUse' || eventName === 'PostToolUseFailure'
  const isHumanEvent =
    eventName === 'Notification' || eventName === 'Elicitation' || eventName === 'ElicitationResult'
  if (!isPreTool && !isPostTool && !isHumanEvent) {
    return undefined
  }

  const owner = agentId
    ? contexts.get(key)?.sessionId
    : state.claudeSessionOwnerByPaneKey.get(paneKey)
  if (isHumanEvent && owner && owner !== sessionId) {
    return null
  }
  let context = contexts.get(key)
  if (!context || (sessionId && context.sessionId !== sessionId)) {
    context = { sessionId, activeToolIds: new Set() }
    contexts.set(key, context)
  }
  const toolUseId = readFirstString(payload, ['tool_use_id', 'toolUseId'])
  if (isPreTool && toolUseId) {
    context.activeToolIds.add(toolUseId)
  }
  if (isPostTool && toolUseId) {
    context.activeToolIds.delete(toolUseId)
  }
  if (eventName === 'Elicitation') {
    const serverName = readString(payload, 'mcp_server_name')
    context.elicitation = serverName
      ? { serverName, elicitationId: readString(payload, 'elicitation_id') }
      : undefined
    return null
  }

  const lead = state.claudeLeadStateByPaneKey.get(paneKey)
  const wait = lead?.state === 'waiting' ? lead.waitingHumanPrompt : undefined
  if (isPostTool && !wait) {
    context.elicitation = undefined
  }
  if (eventName === 'Notification') {
    const type = readString(payload, 'notification_type')
    const kind =
      type === 'permission_prompt'
        ? type
        : type === 'elicitation_dialog' || type === 'url_dialog'
          ? 'elicitation_dialog'
          : null
    if (!kind || lead?.state === 'waiting') {
      return null
    }
    if (agentId) {
      upsertWorkingClaudeSubagent(
        getOrCreateClaudeSubagentRoster(state, paneKey),
        agentId,
        {},
        Date.now()
      )
    }
    const activeTool =
      context.activeToolIds.size === 1 ? context.activeToolIds.values().next().value : undefined
    context.permissionWithoutActiveTool =
      kind === 'permission_prompt' && context.activeToolIds.size === 0
    setClaudeMainAgentTurnState(state, paneKey, {
      state: 'waiting',
      ...(agentId ? { waitingAgentId: agentId } : {}),
      ...(kind === 'permission_prompt' && activeTool ? { waitingToolUseId: activeTool } : {}),
      waitingHumanPrompt: {
        kind,
        sessionId,
        ...(kind === 'elicitation_dialog' ? context.elicitation : {})
      },
      ...(lead ? { stateBeforeWait: lead } : {})
    })
    resolveToolState(
      state,
      paneKey,
      {
        hasToolUpdate: true,
        hasToolInputField: true,
        toolInput: readString(payload, 'message')
      },
      { resetOnNewTurn: false }
    )
    return buildClaudeCachedLeadStatusPayload(state, eventName, paneKey, payload)
  }
  if (eventName === 'ElicitationResult') {
    if (
      !wait ||
      wait.kind !== 'elicitation_dialog' ||
      lead?.waitingAgentId !== agentId ||
      wait.sessionId !== sessionId ||
      !wait.serverName ||
      wait.serverName !== readString(payload, 'mcp_server_name') ||
      wait.elicitationId !== readString(payload, 'elicitation_id')
    ) {
      return null
    }
    context.elicitation = undefined
  } else if (wait) {
    if (agentId) {
      upsertWorkingClaudeSubagent(
        getOrCreateClaudeSubagentRoster(state, paneKey),
        agentId,
        {},
        Date.now()
      )
    }
    const ownsWait = lead?.waitingAgentId === agentId && wait.sessionId === sessionId
    if (eventName === 'PreToolUse' && payload.tool_name === 'AskUserQuestion') {
      return undefined
    }
    const completedWait =
      isPostTool &&
      (wait.kind === 'elicitation_dialog'
        ? !wait.serverName
        : lead?.waitingToolUseId !== undefined && toolUseId === lead.waitingToolUseId)
    const resumedUncorrelatedPermission =
      wait.kind === 'permission_prompt' &&
      context.permissionWithoutActiveTool &&
      (isPreTool || isPostTool)
    if (!ownsWait || (!completedWait && !resumedUncorrelatedPermission)) {
      return buildClaudeCachedLeadStatusPayload(state, eventName, paneKey, payload)
    }
  } else {
    return undefined
  }
  context.elicitation = undefined
  context.permissionWithoutActiveTool = undefined
  setClaudeMainAgentTurnState(state, paneKey, lead?.stateBeforeWait ?? { state: 'working' })
  resolveToolState(state, paneKey, clearActiveToolFieldsUpdate(), { resetOnNewTurn: false })
  return buildClaudeCachedLeadStatusPayload(state, eventName, paneKey, payload)
}
