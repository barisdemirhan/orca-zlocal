import type { TerminalParkingFoundation } from './terminal/workspace-mounting/use-terminal-parking-foundation'

export function addControllerChangedWorktreesToDirty(
  dirty: Set<string>,
  previous: TerminalParkingFoundation,
  controller: TerminalParkingFoundation
): void {
  const {
    activeView,
    activityTerminalPortals,
    renderedActiveWorktreeId,
    terminalParkingEnabled,
    terminalRetentionBudgetEnabled,
    workspaceSurfaceIds
  } = controller
  if (
    previous.activeView !== activeView ||
    previous.renderedActiveWorktreeId !== renderedActiveWorktreeId
  ) {
    if (previous.renderedActiveWorktreeId) {
      dirty.add(previous.renderedActiveWorktreeId)
    }
    if (renderedActiveWorktreeId) {
      dirty.add(renderedActiveWorktreeId)
    }
  }
  if (previous.activityTerminalPortals !== activityTerminalPortals) {
    for (const portal of [...previous.activityTerminalPortals, ...activityTerminalPortals]) {
      dirty.add(portal.worktreeId)
    }
  }
  if (previous.workspaceSurfaceIds !== workspaceSurfaceIds) {
    const currentIds = controller.workspaceSurfaceIdSet
    const previousIds = previous.workspaceSurfaceIdSet
    for (const id of previous.workspaceSurfaceIds) {
      if (!currentIds.has(id)) {
        dirty.add(id)
      }
    }
    for (const id of workspaceSurfaceIds) {
      if (!previousIds.has(id)) {
        dirty.add(id)
      }
    }
  }
  if (
    previous.terminalParkingEnabled !== terminalParkingEnabled ||
    previous.terminalRetentionBudgetEnabled !== terminalRetentionBudgetEnabled
  ) {
    for (const id of controller.mountedWorktreeIdsRef.current) {
      dirty.add(id)
    }
  }
}
