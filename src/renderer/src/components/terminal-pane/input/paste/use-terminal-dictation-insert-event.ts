import { useEffect } from 'react'
import { registerDictationTerminalTarget } from '@/components/dictation/dictation-insertion-target'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from '../../pty-transport/pty-transport-types'
import {
  acquireTerminalInputMountLease,
  hasTerminalMountRetentionLease
} from '../../terminal-mount-retention-leases'
import { handleTerminalProgrammaticTextPaste } from './terminal-programmatic-text-paste'

export function useTerminalDictationInsertEvent({
  isActiveRef,
  managerRef,
  paneTransportsRef,
  tabId,
  worktreeIdRef
}: {
  isActiveRef: React.RefObject<boolean>
  managerRef: React.RefObject<PaneManager | null>
  paneTransportsRef: React.RefObject<Map<number, PtyTransport>>
  tabId: string
  worktreeIdRef: React.RefObject<string>
}): void {
  // Dictation finishes into the pane it started in, even if this tab was switched away meanwhile.
  useEffect(
    () =>
      registerDictationTerminalTarget(tabId, async (text, paneId) => {
        // A retained (hidden) tab keeps its terminal mounted until the insertion lands.
        const releaseLease = hasTerminalMountRetentionLease(worktreeIdRef.current, tabId)
          ? acquireTerminalInputMountLease({ worktreeId: worktreeIdRef.current, tabId })
          : undefined
        try {
          return await handleTerminalProgrammaticTextPaste({
            detail: { tabId, text, paneId },
            tabId,
            getManager: () => managerRef.current,
            getPaneTransports: () => paneTransportsRef.current,
            // A hidden tab's terminal must not take focus from where the user went.
            focusAfterPaste: () => isActiveRef.current
          })
        } finally {
          releaseLease?.()
        }
      }),
    [isActiveRef, managerRef, paneTransportsRef, tabId, worktreeIdRef]
  )
}
