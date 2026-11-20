import type { AgentHookServer } from '../server/agent-hook-server'
import type { AgentHubLedger } from '../../runtime/agent-hub/agent-hub-ledger'

type SessionTabsRepublisher = {
  agentHub?: Pick<AgentHubLedger, 'clearProgress'>
  getTerminalWorktreeIdForHandle(handle: string): string | null
  getTerminalWorktreeIdForPaneKey(paneKey: string): string | null
  scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree(worktreeId: string): void
  touchMobileSessionTabsForWorktree(worktreeId: string): void
}

type StatusStore = Pick<
  AgentHookServer,
  | 'subscribeStatusFreshness'
  | 'subscribeStatusRowMutations'
  | 'subscribeStatusChanges'
  | 'getStatusChangeSnapshot'
>

/** Status-only changes need session.tabs republishing even without PTY activity. */
export function installHookStatusSessionTabsRepublish(
  statusStore: StatusStore,
  getRuntime: () => SessionTabsRepublisher | null | undefined
): () => void {
  const activePanes = (statuses: ReturnType<StatusStore['getStatusChangeSnapshot']>) =>
    new Set(
      statuses
        .filter(
          (status) =>
            status.observedInCurrentRuntime &&
            (status.state === 'working' || status.state === 'blocked' || status.state === 'waiting')
        )
        .map((status) => status.paneKey)
    )
  let previousActive = activePanes(statusStore.getStatusChangeSnapshot())
  const unsubscribeStatus = statusStore.subscribeStatusChanges((statuses) => {
    for (const status of statuses) {
      // Only a finished turn clears it: blocked/waiting resume the same work, and an absent or
      // unconfirmed host row is not evidence that a remote turn ended.
      if (
        status.observedInCurrentRuntime &&
        status.state === 'done' &&
        previousActive.has(status.paneKey)
      ) {
        getRuntime()?.agentHub?.clearProgress(status.paneKey)
      }
    }
    previousActive = activePanes(statuses)
  })
  const resolveWorktreeId = (
    identity: { paneKey: string; worktreeId?: string; terminalHandle?: string },
    runtime: SessionTabsRepublisher
  ): string | null =>
    identity.worktreeId ??
    (identity.terminalHandle
      ? runtime.getTerminalWorktreeIdForHandle(identity.terminalHandle)
      : null) ??
    runtime.getTerminalWorktreeIdForPaneKey(identity.paneKey)

  const unsubscribeMutations = statusStore.subscribeStatusRowMutations((mutation) => {
    const runtime = getRuntime()
    if (!runtime) {
      return
    }
    const worktreeIds = new Set<string>()
    for (const identity of [mutation.before, mutation.after]) {
      if (!identity) {
        continue
      }
      const worktreeId = resolveWorktreeId(identity, runtime)
      if (worktreeId) {
        worktreeIds.add(worktreeId)
      }
    }
    for (const worktreeId of worktreeIds) {
      runtime.touchMobileSessionTabsForWorktree(worktreeId)
    }
  })
  const unsubscribeFreshness = statusStore.subscribeStatusFreshness((status) => {
    const runtime = getRuntime()
    if (!runtime) {
      return
    }
    const worktreeId = resolveWorktreeId(status, runtime)
    if (worktreeId) {
      runtime.scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree(worktreeId)
    }
  })
  return () => {
    unsubscribeStatus()
    unsubscribeMutations()
    unsubscribeFreshness()
  }
}
