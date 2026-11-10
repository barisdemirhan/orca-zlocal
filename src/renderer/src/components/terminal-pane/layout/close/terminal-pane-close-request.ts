import type { PaneManager } from '@/lib/pane-manager/pane-manager'

export type TerminalPaneCloseRequest = { leafId?: string; confirm?: boolean }

/** Closes the requested leaf's pane, else the active pane, else the first; false when none resolves. */
export function closeTerminalPaneForRequest(
  manager: Pick<PaneManager, 'getNumericIdForLeaf' | 'getActivePane' | 'getPanes'> | null,
  request: TerminalPaneCloseRequest | undefined,
  actions: {
    executeClosePane: (paneId: number) => void
    requestClosePane: (paneId: number) => void
  }
): boolean {
  const paneId = request?.leafId
    ? manager?.getNumericIdForLeaf(request.leafId)
    : (manager?.getActivePane() ?? manager?.getPanes()[0])?.id
  if (paneId === null || paneId === undefined) {
    return false
  }
  if (request?.confirm === false) {
    actions.executeClosePane(paneId)
  } else {
    actions.requestClosePane(paneId)
  }
  return true
}
