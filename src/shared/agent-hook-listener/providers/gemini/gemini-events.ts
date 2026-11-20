import {
  normalizeAgentStatusPayload,
  type ParsedAgentStatusPayload
} from '../../../agent-status/contracts/agent-status-types'
import type { HookListenerState } from '../../listener-state'
import { resolvePrompt, resolveToolState } from '../../prompt-fields'
import { extractToolFields, isNewTurnEvent } from '../../provider-event-routing'
import { readString } from '../../tool-input-preview'
import { clearActiveToolFieldsUpdate } from '../../interactive-tool'

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
    const details = hookPayload.details
    const detailToolName =
      typeof details === 'object' && details !== null && 'tool_name' in details
        ? details.tool_name
        : undefined
    state.geminiPermissionByPaneKey.set(paneKey, {
      sessionId,
      toolCallId: readString(hookPayload, 'tool_call_id'),
      toolName:
        readString(hookPayload, 'tool_name') ??
        (typeof detailToolName === 'string' ? detailToolName : undefined)
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
      const toolName = readString(hookPayload, 'tool_name') ?? readString(hookPayload, 'name')
      const toolCallId = readString(hookPayload, 'tool_call_id')
      if (
        (eventName === 'BeforeTool' ||
          eventName === 'AfterTool' ||
          eventName === 'PreToolUse' ||
          eventName === 'PostToolUse') &&
        pending.sessionId === sessionId &&
        (!pending.toolName || !toolName || pending.toolName === toolName) &&
        (!pending.toolCallId || !toolCallId || pending.toolCallId === toolCallId)
      ) {
        state.geminiPermissionByPaneKey.delete(paneKey)
      } else {
        return null
      }
    }
  }
  // Gemini uses BeforeTool/AfterTool; legacy hooks use PreToolUse/PostToolUse.
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
