import React from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  getCrossHostProjectGroupMerge,
  isInProjectGroupHeader
} from '../../../../../../shared/sidebar-list/sections/cross-host-project-group-merge'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'

/** One entry per header, so groups merged across computers list once. */
export function ProjectGroupMoveMenuItems(props: {
  projectGroups: readonly ProjectGroup[]
  currentGroupId: string | null | undefined
  onSelect: (groupId: string) => void
}): React.JSX.Element {
  const { projectGroups, currentGroupId, onSelect } = props
  return (
    <>
      {getCrossHostProjectGroupMerge(projectGroups).displayGroups.map((group) => (
        <DropdownMenuItem
          key={group.id}
          disabled={isInProjectGroupHeader(projectGroups, currentGroupId, group.id)}
          onSelect={() => onSelect(group.id)}
        >
          <span className="max-w-48 truncate">{group.name}</span>
        </DropdownMenuItem>
      ))}
    </>
  )
}
