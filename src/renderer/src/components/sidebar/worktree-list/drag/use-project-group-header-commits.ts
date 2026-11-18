import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { isSameRepoRow } from '@/store/repos/repo-host-identity'
import { setProjectGroupHeaderTabOrder } from '@/store/project-groups/project-group-header-mutations'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'

export function useProjectGroupHeaderCommits(args: {
  projectGroups: readonly ProjectGroup[]
  projectGroupOwnerHostIdByGroupId: ReadonlyMap<string, ExecutionHostId | null>
  onScrollIntent: () => void
}) {
  const { projectGroups, projectGroupOwnerHostIdByGroupId, onScrollIntent } = args
  const moveProjectToGroup = useAppStore((s) => s.moveProjectToGroup)
  const updateProjectGroup = useAppStore((s) => s.updateProjectGroup)
  const commitProjectGroupHeaderOrder = useCallback(
    (groupId: string, tabOrder: number) => {
      if (!Number.isFinite(tabOrder)) {
        return
      }
      onScrollIntent()
      // Why: manual order persists on the group's own host; the focused host may not hold this row.
      const ownerHostId = projectGroupOwnerHostIdByGroupId.get(groupId)
      setProjectGroupHeaderTabOrder(
        { projectGroups, updateProjectGroup },
        { groupId, tabOrder, ownerHostId: ownerHostId ?? undefined }
      )
    },
    [projectGroupOwnerHostIdByGroupId, projectGroups, onScrollIntent, updateProjectGroup]
  )
  const commitMoveToProjectGroup = useCallback(
    (project: Repo, groupId: string) => {
      const liveProject = useAppStore.getState().repos.find((repo) => isSameRepoRow(repo, project))
      if (liveProject) {
        onScrollIntent()
        void moveProjectToGroup(liveProject, groupId)
      }
    },
    [moveProjectToGroup, onScrollIntent]
  )
  return { commitProjectGroupHeaderOrder, commitMoveToProjectGroup }
}
