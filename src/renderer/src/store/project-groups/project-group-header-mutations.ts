import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import {
  getRepoExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { getCrossHostProjectGroupMembers } from '../../../../shared/sidebar-list/sections/cross-host-project-group-merge'
import { getProjectGroupCatalogHostId } from './project-group-owner-routing'
import type { DeleteProjectGroupWithContainedProjectsResult, RepoSlice } from '../repos/repo-state'

type HeaderMutationStore = Pick<
  RepoSlice,
  'updateProjectGroup' | 'deleteProjectGroupWithContainedProjects'
> & {
  projectGroups: readonly ProjectGroup[]
}

/**
 * Renames every group behind a header, or none: a host that refuses the name would split the
 * header in two, so names already written go back.
 */
export async function renameProjectGroupHeader(
  store: HeaderMutationStore,
  args: { groupId: string; name: string; hostId?: ExecutionHostId }
): Promise<boolean> {
  const members = getCrossHostProjectGroupMembers(store.projectGroups, args.groupId)
  if (members.length <= 1) {
    return store.updateProjectGroup(args.groupId, { name: args.name }, { hostId: args.hostId })
  }
  // Why this app's catalog last: only paired hosts can be unreachable, so an offline server changes nothing.
  const ordered = [...members].sort(
    (left, right) =>
      Number(getProjectGroupCatalogHostId(left) === 'local') -
      Number(getProjectGroupCatalogHostId(right) === 'local')
  )
  const renamed: ProjectGroup[] = []
  for (const member of ordered) {
    const accepted = await store.updateProjectGroup(
      member.id,
      { name: args.name },
      { hostId: getRepoExecutionHostId(member) }
    )
    if (!accepted) {
      await Promise.all(
        renamed.map((done) =>
          store.updateProjectGroup(
            done.id,
            { name: done.name },
            { hostId: getRepoExecutionHostId(done) }
          )
        )
      )
      return false
    }
    renamed.push(member)
  }
  return true
}

/** Deletes the group on each host behind a header; one result per group. */
export async function deleteProjectGroupHeader(
  store: HeaderMutationStore,
  groupId: string,
  options: Parameters<RepoSlice['deleteProjectGroupWithContainedProjects']>[1]
): Promise<DeleteProjectGroupWithContainedProjectsResult[]> {
  const members = getCrossHostProjectGroupMembers(store.projectGroups, groupId)
  if (members.length <= 1) {
    return [await store.deleteProjectGroupWithContainedProjects(groupId, options)]
  }
  const results: DeleteProjectGroupWithContainedProjectsResult[] = []
  for (const member of members) {
    results.push(
      await store.deleteProjectGroupWithContainedProjects(member.id, {
        ...options,
        hostId: getRepoExecutionHostId(member)
      })
    )
  }
  return results
}

/** Writes a header's position to all its groups, so it keeps its place if another member comes to lead it. */
export function setProjectGroupHeaderTabOrder(
  store: Pick<HeaderMutationStore, 'projectGroups' | 'updateProjectGroup'>,
  args: { groupId: string; tabOrder: number; ownerHostId?: ExecutionHostId }
): void {
  const members = getCrossHostProjectGroupMembers(store.projectGroups, args.groupId)
  if (members.length <= 1) {
    void store.updateProjectGroup(
      args.groupId,
      { tabOrder: args.tabOrder },
      { hostId: args.ownerHostId }
    )
    return
  }
  for (const member of members) {
    void store.updateProjectGroup(
      member.id,
      { tabOrder: args.tabOrder },
      { hostId: getRepoExecutionHostId(member) }
    )
  }
}
