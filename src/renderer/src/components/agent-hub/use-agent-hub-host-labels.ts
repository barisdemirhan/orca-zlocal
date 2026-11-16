import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getMixedWorktreeHostContextLabels } from '../../../../shared/sidebar-list/hosts/host-labels'
import { buildSidebarHostOptions } from '@/components/sidebar/worktree-list/controls/sidebar-host-options'
import { getSettingsFocusedExecutionHostId } from '../../../../shared/execution-host'
import { getHostDisplayLabelOverrides } from '../../../../shared/execution-host/host-setting-overrides'
import { getRepoHostIdentity } from '../../../../shared/repository/repo-host-identity'
import { getRenderableFolderWorkspaces } from '../../../../shared/sidebar-list/folders/folder-workspace-lanes'
import { repoOfWorktree } from '../../../../shared/sidebar-list/feed/sidebar-feed-index'

/**
 * "Local Mac" / SSH host / server labels keyed by worktree host identity, only when the workspaces
 * span more than one host — the sidebar's own rule, fed by the same host options, so a single-host
 * install shows nothing.
 */
export function useAgentHubHostLabels(): ReadonlyMap<string, string> | undefined {
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const settings = useAppStore((s) => s.settings)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  return useMemo(() => {
    const hostLabelById = new Map(
      buildSidebarHostOptions({
        repos,
        sshTargetLabels,
        sshConnectionStates,
        settings,
        runtimeEnvironments,
        runtimeStatusByEnvironmentId,
        hostLabelOverrides: getHostDisplayLabelOverrides(settings)
      }).map((host) => [host.id, host.label])
    )
    const repoMap = new Map(repos.map((repo) => [repo.id, repo]))
    const reposByKey = new Map(repos.map((repo) => [getRepoHostIdentity(repo), repo]))
    return getMixedWorktreeHostContextLabels(
      Object.values(worktreesByRepo).flat(),
      getRenderableFolderWorkspaces(folderWorkspaces, projectGroups),
      (worktree) => repoOfWorktree(repoMap, reposByKey, worktree),
      hostLabelById,
      getSettingsFocusedExecutionHostId(settings)
    )
  }, [
    repos,
    worktreesByRepo,
    folderWorkspaces,
    projectGroups,
    settings,
    sshTargetLabels,
    sshConnectionStates,
    runtimeEnvironments,
    runtimeStatusByEnvironmentId
  ])
}
