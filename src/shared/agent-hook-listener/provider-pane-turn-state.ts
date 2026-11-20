import type { ClaudeHumanPromptContext } from './providers/claude/claude-human-notifications'
import type { HookListenerState } from './listener-state'
import { deletePaneScopedCacheEntry, movePaneScopedMapEntries } from './pane-scoped-cache-entries'

export type GrokActiveTurn = {
  promptId?: string
  sessionId?: string
}

export type GeminiPendingPermission = { sessionId?: string; toolCallId?: string; toolName?: string }

/** Per-pane waits on a human answer that the hub surfaces; torn down with the pane's turn. */
export type HumanTurnMaps = {
  claudeHumanPromptContextByPaneKey: Map<string, ClaudeHumanPromptContext>
  geminiPermissionByPaneKey: Map<string, GeminiPendingPermission>
}

export function createHumanTurnMaps(): HumanTurnMaps {
  return { claudeHumanPromptContextByPaneKey: new Map(), geminiPermissionByPaneKey: new Map() }
}

export function forgetHumanTurns(state: HumanTurnMaps, paneKey: string): void {
  deletePaneScopedCacheEntry(state.claudeHumanPromptContextByPaneKey, paneKey)
  state.geminiPermissionByPaneKey.delete(paneKey)
}

export function moveHumanTurns(state: HumanTurnMaps, fromPaneKey: string, toPaneKey: string): void {
  movePaneScopedMapEntries(state.claudeHumanPromptContextByPaneKey, fromPaneKey, toPaneKey)
  movePaneScopedMapEntries(state.geminiPermissionByPaneKey, fromPaneKey, toPaneKey)
}

export function clearHumanTurns(state: HumanTurnMaps): void {
  state.claudeHumanPromptContextByPaneKey.clear()
  state.geminiPermissionByPaneKey.clear()
}

export function clearPaneTurnCacheState(state: HookListenerState, paneKey: string): void {
  state.lastPromptByPaneKey.delete(paneKey)
  state.lastToolByPaneKey.delete(paneKey)
  state.antigravityCompletedTranscriptByPaneKey.delete(paneKey)
  state.antigravityChildWorkByPaneKey.delete(paneKey)
  state.jcodeTurnPromptByPaneKey.delete(paneKey)
  state.ampCompletedCacheKeys.delete(paneKey)
  state.grokActiveTurnByPaneKey.delete(paneKey)
  state.grokMainAgentStatusByPaneKey.delete(paneKey)
  state.grokBackgroundTasksByPaneKey.delete(paneKey)
}
