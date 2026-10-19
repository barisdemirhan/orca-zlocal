import { useMemo } from 'react'
import { useAppStore } from '@/store'

export function useAgentHubGroupLabels(): ReadonlyMap<string, string> {
  const groups = useAppStore((state) => state.projectGroups)
  return useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups])
}
