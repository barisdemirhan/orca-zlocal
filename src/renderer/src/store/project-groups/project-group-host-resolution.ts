import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { getRepoExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  getCrossHostProjectGroupMembers,
  getCrossHostProjectGroupMerge,
  resolveDisplayProjectGroupId
} from '../../../../shared/sidebar-list/sections/cross-host-project-group-merge'
import { getRuntimeTargetHostId } from '../../runtime/rpc/targets/runtime-client-target'
import {
  getProjectGroupCatalogHostId,
  isProjectGroupJoinableFromCatalog
} from './project-group-owner-routing'
import type { RepoSlice } from '../repos/repo-state'

type HostResolutionStore = Pick<RepoSlice, 'createProjectGroup' | 'fetchProjectGroups'> & {
  projectGroups: readonly ProjectGroup[]
}

function findCatalogMember(
  projectGroups: readonly ProjectGroup[],
  groupId: string,
  catalogHostId: ExecutionHostId
): ProjectGroup | undefined {
  return getCrossHostProjectGroupMembers(projectGroups, groupId).find(
    (member) => getProjectGroupCatalogHostId(member) === catalogHostId
  )
}

function getDisplayParent(
  projectGroups: readonly ProjectGroup[],
  groupId: string
): ProjectGroup | undefined {
  const { displayGroups } = getCrossHostProjectGroupMerge(projectGroups)
  const displayId = resolveDisplayProjectGroupId(projectGroups, groupId)
  const parentId = displayGroups.find((group) => group.id === displayId)?.parentGroupId
  return parentId ? displayGroups.find((group) => group.id === parentId) : undefined
}

/**
 * Finds the group a project should really join when it is sent to a header: the
 * member on the project's own host, or a new same-named group created there.
 */
export function createProjectGroupHostResolver(get: () => HostResolutionStore) {
  const queueByCatalog = new Map<ExecutionHostId, Promise<unknown>>()

  // Why a queue: moves that overlap must not each create the group, and a refresh
  // answered before another move's create landed would drop that new row.
  const enqueue = <T>(catalogHostId: ExecutionHostId, task: () => Promise<T>): Promise<T> => {
    const run = (queueByCatalog.get(catalogHostId) ?? Promise.resolve()).then(task, task)
    queueByCatalog.set(
      catalogHostId,
      run.catch(() => undefined)
    )
    return run
  }

  const createInCatalog = async (
    source: ProjectGroup,
    catalogHostId: ExecutionHostId,
    seen: Set<string>
  ): Promise<string | null> => {
    const projectGroups = get().projectGroups
    const existing = findCatalogMember(projectGroups, source.id, catalogHostId)
    if (existing) {
      return existing.id
    }
    const parent = getDisplayParent(projectGroups, source.id)
    let parentGroupId: string | null = null
    if (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      parentGroupId = await createInCatalog(parent, catalogHostId, seen)
      if (!parentGroupId) {
        return null
      }
    }
    const created = await get().createProjectGroup(
      source.name,
      catalogHostId,
      parentGroupId ? { parentGroupId } : undefined
    )
    return created?.id ?? null
  }

  /** The id to send to the project's host; null when that host could not take the group. */
  return async function resolveProjectGroupForHost(args: {
    groupId: string
    repoHostId: ExecutionHostId
    target: RuntimeClientTarget
  }): Promise<string | null> {
    const { groupId, repoHostId, target } = args
    const projectGroups = get().projectGroups
    const catalogHostId = getRuntimeTargetHostId(target)
    const hostMember = getCrossHostProjectGroupMembers(projectGroups, groupId).find(
      (member) => getRepoExecutionHostId(member) === repoHostId
    )
    if (hostMember) {
      return hostMember.id
    }
    if (isProjectGroupJoinableFromCatalog(projectGroups, groupId, target)) {
      return groupId
    }
    const catalogMember = findCatalogMember(projectGroups, groupId, catalogHostId)
    if (catalogMember) {
      return catalogMember.id
    }
    const source = getCrossHostProjectGroupMembers(projectGroups, groupId)[0]
    if (!source) {
      return null
    }
    return enqueue(catalogHostId, async () => {
      try {
        // Why refresh: the other computer may have made this group since our last read.
        await get().fetchProjectGroups({
          runtimeEnvironmentId: target.kind === 'local' ? null : target.environmentId,
          throwOnError: true
        })
      } catch (err) {
        console.error('Failed to refresh project groups before creating one:', err)
        return null
      }
      return createInCatalog(source, catalogHostId, new Set([source.id]))
    })
  }
}
