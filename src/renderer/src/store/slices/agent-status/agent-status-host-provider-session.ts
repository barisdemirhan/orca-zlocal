import type { AgentStatusEntry } from '../../../../../shared/agent-status/contracts/agent-status-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { findWorktreeById } from '../worktree-helpers'

/** Mirrored rows keep the host's checkpoint across a new turn; only a host frame replaces it. */
export function hostKeepsProviderSession(
  args: {
    state: { worktreesByRepo: Record<string, Worktree[]> }
    routing?: { worktreeId?: string }
  },
  existing: AgentStatusEntry | undefined,
  agentType: AgentStatusEntry['agentType']
): boolean {
  const worktreeId = args.routing?.worktreeId ?? existing?.worktreeId ?? ''
  const worktree = findWorktreeById(args.state.worktreesByRepo, worktreeId)
  return existing?.agentType === agentType && worktree?.runtimeOwnerEnvironmentId !== undefined
}
