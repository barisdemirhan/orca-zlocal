import type { AppState } from '@/store/types'
import { getIndexedAllWorktrees } from '@/store/slices/worktrees/listing/worktree-catalog-index'
import { getIndexedRepoMap } from '@/store/repos/repository-catalog-index'
import { compareWorktreeDisplayName } from '../../../../shared/worktree/display-name-order'
import { orderEmptyQueryWorktrees } from '@/lib/workspace/search/palette/order-empty-query-worktrees'
import {
  getRepoDisplayLabelKey,
  getRepoDisplayLabelsByPath
} from '../../../../shared/repository/appearance/repo-display-labels'
import { getDeleteStateForWorktreeHost } from '../sidebar/workspace-actions/deletion/worktree-delete-state-host-match'
import {
  folderWorkspaceRepoId,
  folderWorkspaceToWorktree
} from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../shared/worktree/types'

export type AgentHubNewAgentProject = {
  id: string
  label: string
  worktrees: Worktree[]
  defaultWorktree: Worktree
}

type LocationState = Pick<
  AppState,
  | 'repos'
  | 'worktreesByRepo'
  | 'projectGroups'
  | 'folderWorkspaces'
  | 'deleteStateByWorktreeId'
  | 'lastVisitedAtByWorktreeId'
>

export function buildAgentHubNewAgentLocations(state: LocationState): AgentHubNewAgentProject[] {
  const repoMap = getIndexedRepoMap(state.repos)
  const repoLabels = getRepoDisplayLabelsByPath(state.repos)
  const projectLabels = new Map(
    state.repos.map((repo) => [
      repo.id,
      repoLabels.get(getRepoDisplayLabelKey(repo)) ?? repo.displayName
    ])
  )
  for (const group of state.projectGroups) {
    projectLabels.set(folderWorkspaceRepoId(group.id), group.name)
  }
  const workspaces = [
    ...getIndexedAllWorktrees(state.worktreesByRepo).filter((worktree) =>
      repoMap.has(worktree.repoId)
    ),
    ...state.folderWorkspaces.map(folderWorkspaceToWorktree)
  ]
  const byProject = new Map<string, Map<string, Worktree>>()
  for (const worktree of workspaces) {
    if (
      !projectLabels.has(worktree.repoId) ||
      worktree.isArchived ||
      worktree.removing ||
      getDeleteStateForWorktreeHost(worktree, state.deleteStateByWorktreeId)?.isDeleting
    ) {
      continue
    }
    const rows = byProject.get(worktree.repoId) ?? new Map<string, Worktree>()
    rows.set(getWorktreeHostIdentity(worktree), worktree)
    byProject.set(worktree.repoId, rows)
  }
  return [...byProject]
    .flatMap(([id, rows]) => {
      const worktrees = [...rows.values()].sort(compareWorktreeDisplayName)
      const defaultWorktree = orderEmptyQueryWorktrees({
        visibleWorktrees: worktrees,
        activeWorktreeId: null,
        lastVisitedAtByWorktreeId: state.lastVisitedAtByWorktreeId
      }).switchableWorktreesForRows[0]
      return defaultWorktree
        ? [{ id, label: projectLabels.get(id) ?? '', worktrees, defaultWorktree }]
        : []
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}
