import { useMemo } from 'react'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import { useAppStore } from '../../store'
import {
  selectEvictionExemptTerminalTabIds,
  selectEvictionExemptTerminalTabLayoutKey
} from './parking/retention/terminal-eviction-exempt-tabs'

const EMPTY_TAB_IDS: ReadonlySet<string> = new Set()

export function useTerminalEvictionExemption(
  worktreeId: string,
  terminalTabs: readonly TerminalTab[],
  isForceParked: boolean
): ReadonlySet<string> {
  const layoutKey = useAppStore((state) =>
    isForceParked ? selectEvictionExemptTerminalTabLayoutKey(state, terminalTabs) : ''
  )
  return useMemo(
    () =>
      isForceParked ? selectEvictionExemptTerminalTabIds(worktreeId, terminalTabs) : EMPTY_TAB_IDS,
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- The layout key covers PTYs re-read by the selector.
    [layoutKey, isForceParked, terminalTabs, worktreeId]
  )
}
