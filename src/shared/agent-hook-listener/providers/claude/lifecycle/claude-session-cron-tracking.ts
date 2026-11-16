import type { HookListenerState } from '../../../listener-state'

export function trackClaudeSessionCronInventory(
  state: HookListenerState,
  paneKey: string,
  inventory: { present: boolean; active: boolean },
  isTurnBoundaryWithBackgroundTasks: boolean
): void {
  if (inventory.present) {
    if (inventory.active) {
      state.claudeActiveSessionCronPaneKeys.add(paneKey)
    } else {
      state.claudeActiveSessionCronPaneKeys.delete(paneKey)
    }
  } else if (isTurnBoundaryWithBackgroundTasks) {
    // Why: current Claude may omit an empty cron inventory while still emitting background_tasks.
    state.claudeActiveSessionCronPaneKeys.delete(paneKey)
  }
}
