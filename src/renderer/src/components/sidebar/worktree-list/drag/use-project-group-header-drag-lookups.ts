import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { getCrossHostProjectGroupMerge } from '../../../../../../shared/sidebar-list/sections/cross-host-project-group-merge'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import {
  getRepoExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import type { WorktreeGroupBy } from '../../../../../../shared/sidebar-list/row-types'

export function useProjectGroupHeaderDragLookups(args: {
  groupBy: WorktreeGroupBy
  hasProjectGroups: boolean
  projectGroups: readonly ProjectGroup[]
  headerProjectGroups: readonly ProjectGroup[]
}) {
  const { groupBy, hasProjectGroups, projectGroups, headerProjectGroups } = args
  const repos = useAppStore((s) => s.repos)
  // Why: with one computer a project has no other group to reach by dragging, and a lone header must stay click-only.
  const canDropProjectsOnGroupHeaders = useMemo(
    () =>
      groupBy === 'repo' &&
      hasProjectGroups &&
      new Set([...projectGroups, ...repos].map((row) => getRepoExecutionHostId(row))).size > 1,
    [groupBy, hasProjectGroups, projectGroups, repos]
  )
  const projectGroupByIdForHeaderDrag = useMemo(
    () =>
      new Map(
        [...projectGroups, ...getCrossHostProjectGroupMerge(headerProjectGroups).displayGroups].map(
          (group) => [group.id, group]
        )
      ),
    [headerProjectGroups, projectGroups]
  )
  // Why: an id shared by two hosts has no single owner, so leave it unrouted rather than guess.
  const projectGroupOwnerHostIdByGroupId = useMemo(() => {
    const byGroupId = new Map<string, ExecutionHostId | null>()
    for (const group of projectGroups) {
      const hostId = getRepoExecutionHostId(group)
      const existing = byGroupId.get(group.id)
      byGroupId.set(group.id, existing === undefined || existing === hostId ? hostId : null)
    }
    return byGroupId
  }, [projectGroups])
  return {
    canDropProjectsOnGroupHeaders,
    projectGroupByIdForHeaderDrag,
    projectGroupOwnerHostIdByGroupId
  }
}
