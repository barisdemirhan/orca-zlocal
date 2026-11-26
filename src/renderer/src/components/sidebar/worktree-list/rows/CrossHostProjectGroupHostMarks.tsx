import React from 'react'
import { useSidebarHostScopeOptions } from '../controls/use-sidebar-host-scope-options'
import { sidebarHostDisplayLabel } from '../controls/sidebar-host-options'
import NoticeHostGlyph from './NoticeHostGlyph'
import { useRuntimeHostStatusSelector } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import {
  getRepoExecutionHostId,
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import { getCrossHostProjectGroupMembers } from '../../../../../../shared/sidebar-list/sections/cross-host-project-group-merge'

const hasStatusEntry = (entry: unknown): boolean => entry !== undefined

function MemberHostMark({
  hostId,
  hostLabel
}: {
  hostId: ExecutionHostId
  hostLabel: string
}): React.JSX.Element | null {
  const host = parseExecutionHostId(hostId)
  // A host this session has not read yet is unknown, not disconnected, so it shows no mark.
  const hasRead = useRuntimeHostStatusSelector(
    host?.kind === 'runtime' ? host.environmentId : null,
    hasStatusEntry
  )
  if (host?.kind === 'runtime' && !hasRead) {
    return null
  }
  return <NoticeHostGlyph hostId={hostId} hostLabel={hostLabel} keyboardFocusable />
}

function MemberHostMarks({ hostIds }: { hostIds: ExecutionHostId[] }): React.JSX.Element {
  const { hostOptions } = useSidebarHostScopeOptions()
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {hostIds.map((hostId) => {
        const option = hostOptions.find((candidate) => candidate.id === hostId)
        return (
          <MemberHostMark
            key={hostId}
            hostId={hostId}
            hostLabel={option ? sidebarHostDisplayLabel(option) : hostId}
          />
        )
      })}
    </span>
  )
}

/** One host mark per member of a header that spans several hosts. */
export function CrossHostProjectGroupHostMarks({
  groupId,
  projectGroups
}: {
  groupId: string | undefined
  projectGroups: readonly ProjectGroup[]
}): React.JSX.Element | null {
  const members = groupId ? getCrossHostProjectGroupMembers(projectGroups, groupId) : []
  if (members.length <= 1) {
    return null
  }
  return <MemberHostMarks hostIds={[...new Set(members.map((m) => getRepoExecutionHostId(m)))]} />
}
