import { useCallback } from 'react'
import { useAppStore } from '@/store'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import { toggleMergedProjectGroupCollapse } from './project-collapse-all'

export function useProjectGroupCollapseToggle(args: {
  projectGroups: readonly ProjectGroup[]
  announceProjectCollapse: (groupKey: string) => void
}) {
  const { projectGroups, announceProjectCollapse } = args
  const toggleGroup = useAppStore((s) => s.toggleCollapsedGroup)
  const setCollapsedGroups = useAppStore((s) => s.setCollapsedGroups)
  return useCallback(
    (groupKey: string) => {
      const { collapsedGroups } = useAppStore.getState()
      const merged = toggleMergedProjectGroupCollapse(collapsedGroups, projectGroups, groupKey)
      if (merged) {
        setCollapsedGroups(merged)
      } else {
        toggleGroup(groupKey)
      }
      announceProjectCollapse(groupKey)
    },
    [announceProjectCollapse, projectGroups, setCollapsedGroups, toggleGroup]
  )
}
