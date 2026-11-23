import type { HookListenerState } from '../../../listener-state'
import { reapUnconfirmedRestoredClaudeSubagents } from './claude-subagent-roster'

export function clearClaudeSessionGates(state: HookListenerState, paneKey: string): void {
  state.claudeSubagentRosterByPaneKey.delete(paneKey)
  state.claudeRunningNonAgentTasksByPaneKey.delete(paneKey)
  state.claudeActiveSessionCronPaneKeys.delete(paneKey)
  state.claudeLaunchedBackgroundTasksByPaneKey.delete(paneKey)
}

export function reapRestoredClaudeSubagentsOnManualCompact(
  state: HookListenerState,
  paneKey: string
): void {
  const restoredRoster = state.claudeSubagentRosterByPaneKey.get(paneKey)
  if (
    restoredRoster &&
    reapUnconfirmedRestoredClaudeSubagents(restoredRoster) &&
    restoredRoster.size === 0
  ) {
    state.claudeSubagentRosterByPaneKey.delete(paneKey)
  }
}
