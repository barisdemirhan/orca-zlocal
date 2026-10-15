import {
  normalizeAgentStatusPayload,
  type ParsedAgentStatusPayload
} from '../../agent-status-types'
import type { HookListenerState } from '../listener-state'
import { resolvePrompt, resolveToolState } from '../prompt-fields'
import { extractToolFields, isNewTurnEvent } from '../provider-event-routing'
import { readString } from '../tool-input-preview'
import { clearActiveToolFieldsUpdate } from '../interactive-tool'

export function normalizeGeminiEvent(
  state: HookListenerState,
  eventName: unknown,
  promptText: string,
  paneKey: string,
  hookPayload: Record<string, unknown>
): ParsedAgentStatusPayload | null {
  const sessionId = readString(hookPayload, 'session_id')
  const owner = state.lastStatusByPaneKey.get(paneKey)?.providerSession?.id
  const completingPermissionTurn =
    eventName === 'AfterAgent' && state.geminiPermissionByPaneKey.has(paneKey)
  if (eventName === 'Notification') {
    if (hookPayload.notification_type !== 'ToolPermission' || (owner && sessionId !== owner)) {
      return null
    }
    state.geminiPermissionByPaneKey.set(paneKey, {
      sessionId,
      toolCallId: readString(hookPayload, 'tool_call_id')
    })
  } else if (eventName === 'BeforeAgent' || eventName === 'AfterAgent') {
    const pending = state.geminiPermissionByPaneKey.get(paneKey)
    if (eventName === 'AfterAgent' && pending?.sessionId && sessionId !== pending.sessionId) {
      return null
    }
    state.geminiPermissionByPaneKey.delete(paneKey)
  } else {
    const pending = state.geminiPermissionByPaneKey.get(paneKey)
    if (pending) {
      if (
        (eventName === 'AfterTool' || eventName === 'PostToolUse') &&
        pending.toolCallId &&
        pending.toolCallId === readString(hookPayload, 'tool_call_id') &&
        pending.sessionId === sessionId
      ) {
        state.geminiPermissionByPaneKey.delete(paneKey)
      } else {
        // Tool names alone cannot identify which parallel permission was answered.
        return null
      }
    }
  }
  // Why: Gemini CLI's native pre-tool event is BeforeTool; PreToolUse/PostToolUse still accepted for legacy Antigravity-compatible payloads.
  const stateName =
    eventName === 'Notification'
      ? 'waiting'
      : eventName === 'BeforeAgent' ||
          eventName === 'BeforeTool' ||
          eventName === 'AfterTool' ||
          eventName === 'PreToolUse' ||
          eventName === 'PostToolUse'
        ? 'working'
        : eventName === 'AfterAgent'
          ? 'done'
          : null

  if (!stateName) {
    return null
  }

  const snapshot = resolveToolState(
    state,
    paneKey,
    eventName === 'Notification'
      ? {
          hasToolUpdate: true,
          hasToolInputField: true,
          toolInput: readString(hookPayload, 'message')
        }
      : {
          ...(completingPermissionTurn ? clearActiveToolFieldsUpdate() : {}),
          ...extractToolFields('gemini', eventName, hookPayload)
        },
    { resetOnNewTurn: isNewTurnEvent('gemini', eventName) }
  )

  return normalizeAgentStatusPayload({
    state: stateName,
    prompt: resolvePrompt(state, paneKey, eventName === 'Notification' ? '' : promptText, {
      resetOnNewTurn: isNewTurnEvent('gemini', eventName)
    }),
    agentType: 'gemini',
    toolName: snapshot.toolName,
    toolInput: snapshot.toolInput,
    interactivePrompt: snapshot.interactivePrompt,
    lastAssistantMessage: snapshot.lastAssistantMessage,
    lastAssistantMessageIsToolOutput: snapshot.lastAssistantMessageIsToolOutput
  })
}
