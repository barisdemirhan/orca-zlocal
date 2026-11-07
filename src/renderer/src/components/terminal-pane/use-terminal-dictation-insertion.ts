import { useEffect } from 'react'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport/pty-transport-types'
import {
  acquireTerminalInputMountLease,
  hasTerminalMountRetentionLease
} from './terminal-mount-retention-leases'
import { handleTerminalProgrammaticTextPaste } from './input/paste/terminal-programmatic-text-paste'

type DictationInsertDetail = {
  text?: string
  tabId?: string
  leafId?: string
  paneId?: number
}

function readDictationInsertDetail(detail: unknown): string | DictationInsertDetail | null {
  if (typeof detail === 'string') {
    return detail
  }
  if (typeof detail !== 'object' || detail === null) {
    return null
  }
  if ('tabId' in detail && detail.tabId !== undefined && typeof detail.tabId !== 'string') {
    return null
  }
  const text = 'text' in detail && typeof detail.text === 'string' ? detail.text : undefined
  const tabId = 'tabId' in detail && typeof detail.tabId === 'string' ? detail.tabId : undefined
  const paneId = 'paneId' in detail && typeof detail.paneId === 'number' ? detail.paneId : undefined
  const leafId = 'leafId' in detail && typeof detail.leafId === 'string' ? detail.leafId : undefined
  return { text, tabId, leafId, paneId }
}

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
      const rawDetail = 'detail' in event ? event.detail : undefined
      const detail = readDictationInsertDetail(rawDetail)
      if (!detail) {
        return
      }
      const target = typeof detail === 'object' ? detail : undefined
      const text = typeof detail === 'string' ? detail : detail.text
      if (!text) {
        return
      }
      // Why: an untargeted event is global, so only the foreground tab takes it; a targeted one
      // stays locked to its pane even when this tab is in the background.
      if (target?.tabId ? target.tabId !== tabId : !isActiveRef.current) {
        return
      }
      // Why: the durable leaf id, so a pane replaced under a reused numeric id is not a match.
      const requestedPaneId = target?.leafId
        ? managerRef.current?.getPanes().find((pane) => pane.leafId === target.leafId)?.id
        : target?.paneId
      if (target?.leafId && requestedPaneId === undefined) {
        return
      }
      const leasedOrigin = hasTerminalMountRetentionLease(worktreeIdRef.current, tabId)
      const releaseInsertion = leasedOrigin
        ? acquireTerminalInputMountLease({ worktreeId: worktreeIdRef.current, tabId })
        : undefined
      const accepted = handleTerminalProgrammaticTextPaste({
        detail: {
          tabId,
          text,
          ...(typeof requestedPaneId === 'number' ? { paneId: requestedPaneId } : {})
        },
        tabId,
        shouldFocusAfterPaste: () => !leasedOrigin || isActiveRef.current,
        onFinished: releaseInsertion,
        // Why: the user may have moved on; a targeted insert must not pull focus back.
        focusTerminal: !target?.tabId,
        getManager: () => managerRef.current,
        getPaneTransports: () => paneTransportsRef.current
      })
      // Why: the dispatcher reads `accepted` back off its own detail object.
      if (accepted && typeof rawDetail === 'object' && rawDetail !== null) {
        Object.assign(rawDetail, { accepted: true })
      }
    }
    document.addEventListener('dictation:insertText', onDictationInsert)
    return () => document.removeEventListener('dictation:insertText', onDictationInsert)
  }, [isActiveRef, managerRef, paneTransportsRef, tabId, worktreeIdRef])
}
