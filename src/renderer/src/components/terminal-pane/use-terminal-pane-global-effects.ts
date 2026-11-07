import { isRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import { useEffect, useRef } from 'react'
import {
  FOCUS_TERMINAL_PANE_EVENT,
  PASTE_TERMINAL_TEXT_EVENT,
  TOGGLE_TERMINAL_PANE_EXPAND_EVENT,
  type FocusTerminalPaneDetail,
  type PasteTerminalTextDetail
} from '@/constants/terminal'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport/pty-transport-types'
import type { IDisposable } from '@xterm/xterm'
import { handleFocusTerminalPaneDetail } from './focus-terminal-pane-event'
import { surfaceStaleAgentRow } from './stale-agent-row'
import { useAppStore } from '@/store'
import { useTerminalDictationInsertion } from './use-terminal-dictation-insertion'
import { useTerminalScrollVisibilityMemory } from './use-terminal-scroll-visibility-memory'
import { useTerminalContainerFitSync } from './viewport/use-terminal-container-fit-sync'
import { handleTerminalProgrammaticTextPaste } from './input/paste/terminal-programmatic-text-paste'
import {
  hideTerminalVisibility,
  resumeTerminalVisibility,
  type TerminalHiddenReason
} from './terminal-visibility-resume'
import { useTerminalWindowWakeRecovery } from './use-terminal-window-wake-recovery'
import {
  releaseRendererPtyVisibilityClaim,
  setRendererPtyVisibilityClaim
} from './pty-transport/delivery/pty-renderer-delivery-claims'
import { activePaneIsCoveredByNativeChat } from './native-chat-covered-pane'

type UseTerminalPaneGlobalEffectsArgs = {
  tabId: string
  worktreeId: string
  cwd?: string
  isActive: boolean
  isVisible: boolean
  isChatViewMode?: boolean
  isWorktreeActive?: boolean
  isSyncFitEnabled: boolean
  /** Keep WebGL attached in a laid-out hidden host so a likely reveal skips context and atlas setup. */
  warmRendererWhileHidden?: boolean
  paneCount: number
  managerRef: React.RefObject<PaneManager | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  paneTransportsRef: React.RefObject<Map<number, PtyTransport>>
  panePtyBindingsRef?: React.RefObject<Map<number, IDisposable>>
  isActiveRef: React.RefObject<boolean>
  isVisibleRef: React.RefObject<boolean>
  toggleExpandPane: (paneId: number) => void
}

function reportRendererPtyVisibility(
  paneTransports: ReadonlyMap<number, PtyTransport>,
  visible: boolean
): void {
  for (const transport of paneTransports.values()) {
    const ptyId = transport.getPtyId()
    if (!ptyId || isRemoteRuntimePtyId(ptyId)) {
      // Remote-runtime relay PTYs bypass main’s local visibility registry.
      continue
    }
    setRendererPtyVisibilityClaim(transport, ptyId, visible)
  }
}

export function useTerminalPaneGlobalEffects({
  tabId,
  worktreeId,
  isActive,
  isVisible,
  isChatViewMode = false,
  isWorktreeActive = isVisible,
  isSyncFitEnabled,
  warmRendererWhileHidden = false,
  paneCount,
  managerRef,
  containerRef,
  paneTransportsRef,
  panePtyBindingsRef,
  isActiveRef,
  isVisibleRef,
  toggleExpandPane
}: UseTerminalPaneGlobalEffectsArgs): void {
  const worktreeIdRef = useRef(worktreeId)
  worktreeIdRef.current = worktreeId
  // Starts true so the first render with isVisible=false triggers a
  // suspendRendering(). Background worktrees that mount hidden would
  // otherwise leak WebGL contexts — openTerminal() unconditionally creates
  // one — and exhaust Chromium's ~8-context budget across worktrees.
  const wasVisibleRef = useRef(true)
  const wasWorktreeActiveRef = useRef(isWorktreeActive)
  const hasCompletedVisibleResumeRef = useRef(false)
  const renderingSuspendedByVisibilityRef = useRef(false)
  const hiddenReasonRef = useRef<TerminalHiddenReason | null>(null)
  const warmedWhileHiddenRef = useRef(false)
  const rendererVisible = isVisible && isWorktreeActive
  // Why: the active pane can rebind to a new PTY (deferred reattach / eager
  // adopt) or switch active leaf without isActive/isVisible/isWorktreeActive
  // flipping. Derive the active leaf's live PTY reactively from the same
  // leaf→PTY binding the reattach path writes, so the active-renderer-pty report
  // below re-fires on rebind — otherwise main keeps the stale id and the live
  // PTY loses its interactive reserve.
  const activeLeafPtyId = useAppStore((state) => {
    const layout = state.terminalLayoutsByTabId[tabId]
    const activeLeafId = layout?.activeLeafId
    return activeLeafId ? (layout.ptyIdsByLeafId?.[activeLeafId] ?? null) : null
  })
  const {
    captureViewportPositions,
    withSuppressedScrollTracking,
    applyPendingFollowOutputRequests,
    scheduleFollowOutputIfNeeded
  } = useTerminalScrollVisibilityMemory({
    managerRef,
    isVisibleRef,
    visibleResumeCompleteRef: wasVisibleRef,
    paneCount
  })
  useTerminalContainerFitSync({
    isVisible: rendererVisible,
    isSyncFitEnabled,
    managerRef,
    containerRef
  })
  useTerminalWindowWakeRecovery({
    isVisible: rendererVisible,
    isChatViewMode,
    managerRef,
    isActiveRef,
    isVisibleRef,
    panePtyBindingsRef
  })

  useEffect(() => {
    const paneTransports = paneTransportsRef.current
    reportRendererPtyVisibility(paneTransports, rendererVisible)
    return () => {
      for (const transport of paneTransports.values()) {
        releaseRendererPtyVisibilityClaim(transport)
      }
    }
  }, [rendererVisible, paneTransportsRef])

  useEffect(() => {
    const manager = managerRef.current
    if (!manager) {
      return
    }
    manager.setAtlasRecoveryVisible?.(rendererVisible)
    // Why: hidden-worktree panes keep their WebGL backing; tab-hidden ones may release it (pane-webgl-renderer).
    containerRef.current?.toggleAttribute('data-worktree-surface-hidden', !isWorktreeActive)
    const wasVisible = wasVisibleRef.current
    const wasWorktreeActive = wasWorktreeActiveRef.current
    isActiveRef.current = isActive
    isVisibleRef.current = rendererVisible
    if (rendererVisible) {
      const shouldUseLightTabResume =
        isWorktreeActive &&
        hasCompletedVisibleResumeRef.current &&
        !renderingSuspendedByVisibilityRef.current &&
        (wasVisible || hiddenReasonRef.current === 'tab')
      resumeTerminalVisibility({
        manager,
        isActive,
        // Tab-wide chat covers only its chat leaf; active split terminals still need reveal focus.
        isChatViewMode: isChatViewMode && activePaneIsCoveredByNativeChat(manager),
        wasVisible,
        shouldUseLightTabResume,
        captureViewportPositions,
        withSuppressedScrollTracking
      })
      renderingSuspendedByVisibilityRef.current = false
      wasVisibleRef.current = true
      wasWorktreeActiveRef.current = isWorktreeActive
      hasCompletedVisibleResumeRef.current = true
      hiddenReasonRef.current = null
      warmedWhileHiddenRef.current = false
      applyPendingFollowOutputRequests()
      return
    }
    if (warmRendererWhileHidden && isWorktreeActive === false) {
      if (wasVisible) {
        captureViewportPositions(false)
      }
      manager.resumeRendering()
      warmedWhileHiddenRef.current = true
      renderingSuspendedByVisibilityRef.current = false
      hiddenReasonRef.current = 'surface'
      wasVisibleRef.current = false
      wasWorktreeActiveRef.current = isWorktreeActive
      return
    }
    if (warmedWhileHiddenRef.current) {
      // Warm-up ended without a reveal; release the context like any hidden worktree.
      warmedWhileHiddenRef.current = false
      manager.suspendRendering()
      renderingSuspendedByVisibilityRef.current = true
      hiddenReasonRef.current = 'surface'
      wasVisibleRef.current = false
      wasWorktreeActiveRef.current = isWorktreeActive
      return
    }
    const hiddenState = hideTerminalVisibility({
      manager,
      wasVisible,
      wasWorktreeActive,
      isWorktreeActive,
      hasCompletedVisibleResume: hasCompletedVisibleResumeRef.current,
      captureViewportPositions
    })
    renderingSuspendedByVisibilityRef.current = hiddenState.renderingSuspended
    hiddenReasonRef.current = hiddenState.hiddenReason

    wasVisibleRef.current = false
    wasWorktreeActiveRef.current = isWorktreeActive
  }, [
    isActive,
    isChatViewMode,
    isWorktreeActive,
    rendererVisible,
    warmRendererWhileHidden,
    applyPendingFollowOutputRequests,
    captureViewportPositions,
    containerRef,
    isActiveRef,
    isVisibleRef,
    managerRef,
    withSuppressedScrollTracking
  ])

  useEffect(() => {
    const ptyId = isActive && isVisible && isWorktreeActive ? activeLeafPtyId : null
    if (!ptyId || isRemoteRuntimePtyId(ptyId)) {
      return
    }
    // Main prioritizes this PTY’s bounded ACK reserve; cleanup deactivates the old binding before rebind.
    window.api.pty.setActiveRendererPty?.(ptyId, true)
    return () => window.api.pty.setActiveRendererPty?.(ptyId, false)
  }, [isActive, isVisible, isWorktreeActive, activeLeafPtyId])

  useEffect(() => {
    const onToggleExpand = (event: Event): void => {
      const detail = (event as CustomEvent<{ tabId?: string }>).detail
      if (!detail?.tabId || detail.tabId !== tabId) {
        return
      }
      const manager = managerRef.current
      if (!manager) {
        return
      }
      const panes = manager.getPanes()
      if (panes.length < 2) {
        return
      }
      const pane = manager.getActivePane() ?? panes[0]
      if (!pane) {
        return
      }
      toggleExpandPane(pane.id)
    }
    window.addEventListener(TOGGLE_TERMINAL_PANE_EXPAND_EVENT, onToggleExpand)
    return () => window.removeEventListener(TOGGLE_TERMINAL_PANE_EXPAND_EVENT, onToggleExpand)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  useEffect(() => {
    const onFocusPane = (event: Event): void => {
      const detail = (event as CustomEvent<FocusTerminalPaneDetail | undefined>).detail
      handleFocusTerminalPaneDetail(detail, {
        tabId,
        manager: managerRef.current,
        acknowledgeAgents: (paneKeys) => useAppStore.getState().acknowledgeAgents(paneKeys),
        surfaceStaleAgentRow,
        scrollToBottomIfOutputSinceLastView: scheduleFollowOutputIfNeeded,
        expandedLeafId: useAppStore.getState().terminalLayoutsByTabId[tabId]?.expandedLeafId,
        toggleExpandPane
      })
    }
    window.addEventListener(FOCUS_TERMINAL_PANE_EVENT, onFocusPane)
    return () => window.removeEventListener(FOCUS_TERMINAL_PANE_EVENT, onFocusPane)
    // toggleExpandPane only reads refs, like the expand listener above, so it is not re-subscribed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, managerRef, scheduleFollowOutputIfNeeded])

  useEffect(() => {
    const onPasteText = (event: Event): void => {
      const detail = (event as CustomEvent<PasteTerminalTextDetail | undefined>).detail
      handleTerminalProgrammaticTextPaste({
        detail,
        tabId,
        getManager: () => managerRef.current,
        getPaneTransports: () => paneTransportsRef.current
      })
    }
    window.addEventListener(PASTE_TERMINAL_TEXT_EVENT, onPasteText)
    return () => window.removeEventListener(PASTE_TERMINAL_TEXT_EVENT, onPasteText)
  }, [tabId, managerRef, paneTransportsRef])

  useTerminalDictationInsertion({
    tabId,
    worktreeIdRef,
    managerRef,
    paneTransportsRef,
    isActiveRef
  })
}
