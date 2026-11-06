import { recordCollapsedGroupChanges } from '@/store/slices/ui/collapsed-group-toggle'
import { getCrossHostProjectGroupMerge } from '../../../../../../shared/sidebar-list/sections/cross-host-project-group-merge'
import {
  getProjectGroupHeaderKey,
  isProjectOrPinnedSectionGroupKey
} from '../../../../../../shared/sidebar-list/sections/group-keys'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import type { HostSectionRow } from '../../../../../../shared/sidebar-list/hosts/host-section-rows'

export function getRenderedProjectCollapseKeys(rows: readonly HostSectionRow[]): string[] {
  const keys = new Set<string>()
  for (const row of rows) {
    if (row.type !== 'header') {
      continue
    }
    const key = row.collapseKey ?? row.key
    if (isProjectOrPinnedSectionGroupKey(key)) {
      keys.add(key)
    }
  }
  return [...keys]
}

/**
 * The stored keys behind these headers. A merged header's id belongs to its oldest member, which
 * another member replaces while that host is unknown, so every member keeps the header's state.
 */
export function withMergedProjectGroupCollapseKeys(
  projectGroups: readonly ProjectGroup[],
  keys: readonly string[]
): string[] {
  const { displayGroupIdById, membersByDisplayId } = getCrossHostProjectGroupMerge(projectGroups)
  const memberIdsByKey = new Map<string, string[]>()
  for (const [memberId, displayId] of displayGroupIdById) {
    memberIdsByKey.set(
      getProjectGroupHeaderKey(memberId),
      (membersByDisplayId.get(displayId) ?? []).map(({ id }) => id)
    )
  }
  return [
    ...new Set(
      keys.flatMap(
        (key) => memberIdsByKey.get(key)?.map((id) => getProjectGroupHeaderKey(id)) ?? [key]
      )
    )
  ]
}

/** One collapse key per group header, so groups merged across computers count once. */
export function getProjectGroupHeaderCollapseKeys(
  projectGroups: readonly ProjectGroup[]
): string[] {
  return getCrossHostProjectGroupMerge(projectGroups).displayGroups.map(({ id }) =>
    getProjectGroupHeaderKey(id)
  )
}

/** Collapse state after toggling a merged header; null when the header has a single group. */
export function toggleMergedProjectGroupCollapse(
  collapsedGroups: ReadonlySet<string>,
  projectGroups: readonly ProjectGroup[],
  groupKey: string
): Set<string> | null {
  const memberKeys = withMergedProjectGroupCollapseKeys(projectGroups, [groupKey])
  if (memberKeys.length <= 1) {
    return null
  }
  const next = new Set(collapsedGroups)
  const collapse = !collapsedGroups.has(groupKey)
  memberKeys.forEach((key) => (collapse ? next.add(key) : next.delete(key)))
  return next
}

export function areAllProjectsCollapsed(
  projectKeys: readonly string[],
  collapsedGroups: ReadonlySet<string>
): boolean {
  return projectKeys.length > 0 && projectKeys.every((key) => collapsedGroups.has(key))
}

// Expanding clears pinned and every project key, including hidden nested projects.
export function setAllProjectsCollapsed(
  collapsedGroups: ReadonlySet<string>,
  projectKeys: readonly string[],
  collapsed: boolean
): Set<string> {
  const keys = collapsed
    ? projectKeys
    : [...collapsedGroups].filter(isProjectOrPinnedSectionGroupKey)
  const next = new Set(collapsedGroups)
  for (const key of keys) {
    if (collapsed) {
      next.add(key)
    } else {
      next.delete(key)
    }
  }
  return recordCollapsedGroupChanges(collapsedGroups, next, keys)
}
