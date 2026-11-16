import { getTerminalTabOwnerWorktreeId } from '@/store/terminals/ownership/terminal-tab-owner-index'
import { useAppStore } from '@/store'
import type { TerminalColdActivationController } from './terminal-cold-activation'

type ParkedStateInputs = Pick<
  TerminalColdActivationController,
  'effectiveParkedTerminalWorktreeIds' | 'evictionExemptTerminalTabIds'
>

export function addParkedStateChangedWorktreesToDirty(
  dirty: Set<string>,
  previous: ParkedStateInputs,
  current: ParkedStateInputs
): void {
  if (previous.effectiveParkedTerminalWorktreeIds !== current.effectiveParkedTerminalWorktreeIds) {
    for (const id of previous.effectiveParkedTerminalWorktreeIds) {
      if (!current.effectiveParkedTerminalWorktreeIds.has(id)) {
        dirty.add(id)
      }
    }
    for (const id of current.effectiveParkedTerminalWorktreeIds) {
      if (!previous.effectiveParkedTerminalWorktreeIds.has(id)) {
        dirty.add(id)
      }
    }
  }
  if (previous.evictionExemptTerminalTabIds !== current.evictionExemptTerminalTabIds) {
    const state = useAppStore.getState()
    for (const tabId of new Set([
      ...previous.evictionExemptTerminalTabIds,
      ...current.evictionExemptTerminalTabIds
    ])) {
      if (
        previous.evictionExemptTerminalTabIds.has(tabId) ===
        current.evictionExemptTerminalTabIds.has(tabId)
      ) {
        continue
      }
      const id = getTerminalTabOwnerWorktreeId(state.tabsByWorktree, tabId)
      if (id) {
        dirty.add(id)
      }
    }
  }
}
