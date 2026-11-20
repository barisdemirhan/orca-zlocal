import { useAppStore } from '@/store'

/** True when the worktree is the one open in the terminal view, so its hub surfaces can step back. */
export function useAgentHubWorktreeCurrent(worktreeId: string | undefined): boolean {
  return useAppStore(
    (s) =>
      worktreeId !== undefined && s.activeView === 'terminal' && s.activeWorktreeId === worktreeId
  )
}
