import type { ClaudeHumanPromptContext } from './providers/claude/claude-human-notifications'
import { deletePaneScopedCacheEntry, movePaneScopedMapEntries } from './pane-scoped-cache-entries'

export type HermesPaneTurn = {
  ended: boolean
  /** `delegate_task` children run their own turns, under their own session ids, inside the parent's. */
  childSessionIds: Set<string>
  /** The pane's own session, which its children's hooks must not replace. */
  sessionId: string
}

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
