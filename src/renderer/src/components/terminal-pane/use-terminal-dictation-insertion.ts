import { useEffect } from 'react'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport'
import {
  acquireTerminalInputMountLease,
  hasTerminalMountRetentionLease
} from './terminal-mount-retention-leases'
import { handleTerminalProgrammaticTextPaste } from './terminal-programmatic-text-paste'

type DictationInsertionArgs = {
  tabId: string
  worktreeIdRef: React.RefObject<string>
  managerRef: React.RefObject<PaneManager | null>
  paneTransportsRef: React.RefObject<Map<number, PtyTransport>>
  isActiveRef: React.RefObject<boolean>
}

export function useTerminalDictationInsertion({
  tabId,
  worktreeIdRef,
  managerRef,
  paneTransportsRef,
  isActiveRef
}: DictationInsertionArgs): void {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const onDictationInsert = (event: Event): void => {
      const detail = (
        event as CustomEvent<string | { text?: string; tabId?: string; paneId?: number }>
      ).detail
      // Why: a locked dictation origin remains writable after its mirror returns home.
      if (
        !isActiveRef.current &&
        !(
          typeof detail === 'object' &&
          detail?.tabId === tabId &&
          hasTerminalMountRetentionLease(worktreeIdRef.current, tabId)
        )
      ) {
        return
      }
      const text = typeof detail === 'string' ? detail : detail?.text
      if (!text) {
        return
      }
      if (typeof detail === 'object' && detail.tabId && detail.tabId !== tabId) {
        return
      }
      const requestedPaneId = typeof detail === 'object' ? detail.paneId : undefined
      const leasedOrigin = hasTerminalMountRetentionLease(worktreeIdRef.current, tabId)
      const releaseInsertion = leasedOrigin
        ? acquireTerminalInputMountLease({ worktreeId: worktreeIdRef.current, tabId })
        : undefined
      handleTerminalProgrammaticTextPaste({
        detail: {
          tabId,
          text,
          ...(typeof requestedPaneId === 'number' ? { paneId: requestedPaneId } : {})
        },
        tabId,
        shouldFocusAfterPaste: () => !leasedOrigin || isActiveRef.current,
        onFinished: releaseInsertion,
        getManager: () => managerRef.current,
        getPaneTransports: () => paneTransportsRef.current
      })
    }
    document.addEventListener('dictation:insertText', onDictationInsert)
    return () => document.removeEventListener('dictation:insertText', onDictationInsert)
  }, [isActiveRef, managerRef, paneTransportsRef, tabId, worktreeIdRef])
}
