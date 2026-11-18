import { getRepoExecutionHostId, type ExecutionHostId } from '../../execution-host/execution-host'
import type { ProjectGroup } from '../../project/groups/project-group-types'
import { getDistinctProjectGroups } from '../../project/groups/project-groups'
import { compareCodePoints } from '../sorting/text-order'

/**
 * The sidebar's view of project groups once same-named groups from different
 * hosts share one header. The groups themselves stay separate rows on their
 * own hosts; only their display folds together.
 */
export type CrossHostProjectGroupMerge = {
  /** One group per header. A merged header carries its oldest member, with
   *  `parentGroupId` pointing at the display id of its parent. */
  displayGroups: readonly ProjectGroup[]
  /** Member id → the id of the header it renders under. Absent for groups that merged with nothing. */
  displayGroupIdById: ReadonlyMap<string, string>
  /** Header id → the member groups it stands for, at most one per host. Absent for unmerged headers. */
  membersByDisplayId: ReadonlyMap<string, readonly ProjectGroup[]>
}

type MergeSet = {
  members: ProjectGroup[]
  hostIds: Set<ExecutionHostId>
  parentDisplayId: string | null
}

const EMPTY_DISPLAY_IDS: ReadonlyMap<string, string> = new Map()
const EMPTY_MEMBERS: ReadonlyMap<string, readonly ProjectGroup[]> = new Map()

function getPresentParentId(
  group: ProjectGroup,
  groupsById: ReadonlyMap<string, ProjectGroup>
): string | null {
  return group.parentGroupId && groupsById.has(group.parentGroupId) ? group.parentGroupId : null
}

function getProjectGroupDepth(
  group: ProjectGroup,
  groupsById: ReadonlyMap<string, ProjectGroup>
): number {
  const seen = new Set<string>([group.id])
  let depth = 0
  let parentId = getPresentParentId(group, groupsById)
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    depth += 1
    parentId = getPresentParentId(groupsById.get(parentId)!, groupsById)
  }
  return depth
}

function compareOldestFirst(left: ProjectGroup, right: ProjectGroup): number {
  return left.createdAt - right.createdAt || compareCodePoints(left.id, right.id)
}

function buildCrossHostProjectGroupMerge(
  projectGroups: readonly ProjectGroup[]
): CrossHostProjectGroupMerge {
  const distinctGroups = getDistinctProjectGroups(projectGroups)
  const groupsById = new Map(distinctGroups.map((group) => [group.id, group]))
  // Why by depth: a child can only join its sibling on another host once both
  // parents have resolved to the same header.
  const levels: ProjectGroup[][] = []
  for (const group of distinctGroups) {
    ;(levels[getProjectGroupDepth(group, groupsById)] ??= []).push(group)
  }
  const displayGroupIdById = new Map<string, string>()
  const membersByDisplayId = new Map<string, readonly ProjectGroup[]>()
  const displayGroups: ProjectGroup[] = []
  for (const level of levels) {
    const setsByKey = new Map<string, MergeSet[]>()
    const orderedSets: MergeSet[] = []
    // Why oldest first: a host gaining a member later must not change the header's id,
    // which collapse state and header actions key on.
    for (const group of [...(level ?? [])].sort(compareOldestFirst)) {
      const parentId = getPresentParentId(group, groupsById)
      const parentDisplayId = parentId ? (displayGroupIdById.get(parentId) ?? parentId) : null
      const hostId = getRepoExecutionHostId(group)
      const key = `${parentDisplayId ?? ''}\u0000${group.name.trim().toLowerCase()}`
      const candidates = setsByKey.get(key) ?? []
      // Why one per host: two same-named groups on one host are the user's own layout.
      let set = candidates.find((candidate) => !candidate.hostIds.has(hostId))
      if (!set) {
        set = { members: [], hostIds: new Set(), parentDisplayId }
        candidates.push(set)
        setsByKey.set(key, candidates)
        orderedSets.push(set)
      }
      set.members.push(group)
      set.hostIds.add(hostId)
    }
    for (const set of orderedSets) {
      const representative = set.members[0]!
      if (set.members.length > 1) {
        membersByDisplayId.set(representative.id, set.members)
        for (const member of set.members) {
          displayGroupIdById.set(member.id, representative.id)
        }
      }
      displayGroups.push(
        getPresentParentId(representative, groupsById) === set.parentDisplayId
          ? representative
          : { ...representative, parentGroupId: set.parentDisplayId }
      )
    }
  }
  if (membersByDisplayId.size === 0) {
    return {
      displayGroups: distinctGroups,
      displayGroupIdById: EMPTY_DISPLAY_IDS,
      membersByDisplayId: EMPTY_MEMBERS
    }
  }
  return { displayGroups, displayGroupIdById, membersByDisplayId }
}

const mergeByList = new WeakMap<readonly ProjectGroup[], CrossHostProjectGroupMerge>()

/** Memoized on the list's identity, so every reader of one catalog sees the same headers. */
export function getCrossHostProjectGroupMerge(
  projectGroups: readonly ProjectGroup[]
): CrossHostProjectGroupMerge {
  let merge = mergeByList.get(projectGroups)
  if (!merge) {
    merge = buildCrossHostProjectGroupMerge(projectGroups)
    mergeByList.set(projectGroups, merge)
  }
  return merge
}

/** The header id a group renders under; the group's own id when it merged with nothing. */
export function resolveDisplayProjectGroupId(
  projectGroups: readonly ProjectGroup[],
  projectGroupId: string
): string {
  return (
    getCrossHostProjectGroupMerge(projectGroups).displayGroupIdById.get(projectGroupId) ??
    projectGroupId
  )
}

/** Whether a row's group sits under this header, whichever host's group it joined. */
export function isInProjectGroupHeader(
  projectGroups: readonly ProjectGroup[],
  projectGroupId: string | null | undefined,
  headerId: string
): boolean {
  return (
    Boolean(projectGroupId) &&
    resolveDisplayProjectGroupId(projectGroups, projectGroupId!) ===
      resolveDisplayProjectGroupId(projectGroups, headerId)
  )
}

/** Every group sharing a header with this one; empty when the id is not in the list. */
export function getCrossHostProjectGroupMembers(
  projectGroups: readonly ProjectGroup[],
  projectGroupId: string
): readonly ProjectGroup[] {
  const merge = getCrossHostProjectGroupMerge(projectGroups)
  const members = merge.membersByDisplayId.get(
    resolveDisplayProjectGroupId(projectGroups, projectGroupId)
  )
  if (members) {
    return members
  }
  const group = merge.displayGroups.find((candidate) => candidate.id === projectGroupId)
  return group ? [group] : []
}
