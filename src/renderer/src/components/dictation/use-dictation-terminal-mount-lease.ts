import { useLayoutEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import type { DictationState } from '../../../../shared/speech-types'
import type { DictationInsertionTarget } from './dictation-insertion-target'
import { acquireTerminalInputMountLease } from '../terminal-pane/terminal-mount-retention-leases'

export function useDictationTerminalMountLease(
  state: DictationState,
  target: React.RefObject<DictationInsertionTarget | null>
): void {
  const releaseRef = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    if (state === 'idle' || state === 'error') {
      releaseRef.current?.()
      releaseRef.current = null
      return
    }
    const origin = target.current
    const store = useAppStore.getState()
    if (
      releaseRef.current ||
      origin?.kind !== 'terminal' ||
      !store.settings?.experimentalAgentHub
    ) {
      return
    }
    const worktreeId = Object.entries(store.tabsByWorktree).find(([, tabs]) =>
      tabs.some((tab) => tab.id === origin.tabId)
    )?.[0]
    if (worktreeId) {
      // Why: the captured numeric pane must outlive mirror membership until final insertion/cancel.
      releaseRef.current = acquireTerminalInputMountLease({ worktreeId, tabId: origin.tabId })
    }
  }, [state, target])
  useLayoutEffect(() => () => releaseRef.current?.(), [])
}
