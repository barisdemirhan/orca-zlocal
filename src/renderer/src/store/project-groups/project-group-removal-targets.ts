import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import { getProjectGroupSubtreeIds } from '../../../../shared/project/groups/project-groups'
import { getCrossHostProjectGroupMembers } from '../../../../shared/sidebar-list/sections/cross-host-project-group-merge'
import {
  getRepoExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { catalogOwnsHost } from './project-group-owner-routing'

export type ProjectGroupRemovalProject = { id: string; hostId: ExecutionHostId }

export type ProjectGroupRemovalTargets = {
  groupExists: boolean
  deletedGroupIds: Set<string>
  projectIds: string[]
  // Why: ids repeat across hosts and membership is per row, so removal must target the exact member rows.
  projects: ProjectGroupRemovalProject[]
}

export function selectProjectGroupRemovalTargets(
  projectGroups: readonly ProjectGroup[],
  repos: readonly Repo[],
  groupId: string,
  // Why: ids repeat across hosts; without an owner host the caller would target another host's rows.
  hostId?: ExecutionHostId | null
): ProjectGroupRemovalTargets {
  const ownsRowHost = (rowHostId: string): boolean =>
    hostId ? catalogOwnsHost(hostId, rowHostId) : true
  const ownerGroups = hostId
    ? projectGroups.filter((group) => ownsRowHost(getRepoExecutionHostId(group)))
    : projectGroups
  const groupExists = ownerGroups.some((group) => group.id === groupId)
  if (!groupExists) {
    return {
      groupExists: false,
      deletedGroupIds: new Set(),
      projectIds: [],
      projects: []
    }
  }

  const deletedGroupIds = getProjectGroupSubtreeIds(ownerGroups, groupId)
  const projectIds: string[] = []
  const projects: ProjectGroupRemovalProject[] = []
  for (const repo of repos) {
    const repoHostId = getRepoExecutionHostId(repo)
    if (
      repo.projectGroupId &&
      deletedGroupIds.has(repo.projectGroupId) &&
      ownsRowHost(repoHostId)
    ) {
      projectIds.push(repo.id)
      projects.push({ id: repo.id, hostId: repoHostId })
    }
  }

  return {
    groupExists: true,
    deletedGroupIds,
    projectIds,
    projects
  }
}

/** What deleting a header takes with it: each member's subtree, read on that member's own host. */
export function selectProjectGroupHeaderRemovalTargets(
  projectGroups: readonly ProjectGroup[],
  repos: readonly Repo[],
  groupId: string,
  hostId?: ExecutionHostId | null
): ProjectGroupRemovalTargets {
  const members = getCrossHostProjectGroupMembers(projectGroups, groupId)
  if (members.length <= 1) {
    return selectProjectGroupRemovalTargets(projectGroups, repos, groupId, hostId)
  }
  const merged: ProjectGroupRemovalTargets = {
    groupExists: true,
    deletedGroupIds: new Set(),
    projectIds: [],
    projects: []
  }
  for (const member of members) {
    const targets = selectProjectGroupRemovalTargets(
      projectGroups,
      repos,
      member.id,
      getRepoExecutionHostId(member)
    )
    targets.deletedGroupIds.forEach((id) => merged.deletedGroupIds.add(id))
    merged.projectIds.push(...targets.projectIds)
    merged.projects.push(...targets.projects)
  }
  return merged
}
