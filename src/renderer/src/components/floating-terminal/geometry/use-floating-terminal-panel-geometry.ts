import { useCallback, useEffect, useLayoutEffect } from 'react'
import {
  anchorFloatingTerminalPanelBounds,
  clampFloatingTerminalBounds,
  getMaximizedFloatingTerminalBounds,
  persistFloatingTerminalPanelBounds,
  resolveFloatingTerminalPanelBounds,
  shouldReconcileFloatingTerminalPanelBounds,
  type FloatingTerminalPanelBounds,
  type FloatingTerminalPanelCommittedBounds
} from './floating-terminal-panel-bounds'
import { areFloatingTerminalPanelCommittedBoundsEqual } from './floating-terminal-panel-initial-bounds'
import { snapFloatingBoundsToCanvas } from '../../agent-hub/agent-hub-canvas-dot-snap'
import { useFloatingWorkspacePlaceRequests } from '../floating-workspace-place-request'
import type { FloatingTerminalPanelLocalState } from '../state/use-floating-terminal-panel-local-state'
import type { FloatingTerminalPanelStoreState } from '../state/use-floating-terminal-panel-store-state'

type FloatingTerminalPanelGeometryInput = Pick<
  FloatingTerminalPanelLocalState,
  | 'boundsSourceRef'
  | 'committedBoundsRef'
  | 'setBounds'
  | 'maximized'
  | 'stagedBoundsRef'
  | 'lastPersistedBoundsRef'
  | 'setMarkdownCwd'
> &
  Pick<FloatingTerminalPanelStoreState, 'floatingTerminalCwd' | 'setFloatingWorkspacePath'>

export function useFloatingTerminalPanelGeometry({
  boundsSourceRef,
  committedBoundsRef,
  setBounds,
  maximized,
  stagedBoundsRef,
  lastPersistedBoundsRef,
  setFloatingWorkspacePath,
  setMarkdownCwd,
  floatingTerminalCwd
}: FloatingTerminalPanelGeometryInput) {
  const persistUserBounds = useCallback(
    (nextBounds: FloatingTerminalPanelCommittedBounds): void => {
      if (
        areFloatingTerminalPanelCommittedBoundsEqual(lastPersistedBoundsRef.current, nextBounds)
      ) {
        return
      }
      lastPersistedBoundsRef.current = nextBounds
      persistFloatingTerminalPanelBounds(nextBounds)
    },
    [lastPersistedBoundsRef]
  )

  const previewUserBounds = useCallback(
    (nextBounds: FloatingTerminalPanelBounds): void => {
      const clampedBounds = clampFloatingTerminalBounds(nextBounds)
      stagedBoundsRef.current = clampedBounds
      setBounds(clampedBounds)
    },
    [setBounds, stagedBoundsRef]
  )

  const commitUserBounds = useCallback(
    (nextBounds: FloatingTerminalPanelBounds | null = stagedBoundsRef.current): void => {
      if (!nextBounds) {
        return
      }
      // Why: on the Agent Hub canvas a dropped panel lands on the dots.
      const clampedBounds = snapFloatingBoundsToCanvas(clampFloatingTerminalBounds(nextBounds))
      stagedBoundsRef.current = null
      setBounds(clampedBounds)
      const anchoredBounds = anchorFloatingTerminalPanelBounds(clampedBounds)
      if (!anchoredBounds) {
        return
      }
      committedBoundsRef.current = anchoredBounds
      boundsSourceRef.current = 'user'
      persistUserBounds(anchoredBounds)
    },
    [boundsSourceRef, committedBoundsRef, persistUserBounds, setBounds, stagedBoundsRef]
  )

  const reconcileBounds = useCallback((): void => {
    if (maximized) {
      setBounds(getMaximizedFloatingTerminalBounds())
      return
    }
    setBounds((currentBounds) => {
      const source = boundsSourceRef.current
      if (!shouldReconcileFloatingTerminalPanelBounds(source)) {
        return currentBounds
      }
      return resolveFloatingTerminalPanelBounds(committedBoundsRef.current, source)
    })
  }, [boundsSourceRef, committedBoundsRef, maximized, setBounds])

  useLayoutEffect(() => {
    reconcileBounds()
  }, [reconcileBounds])

  // Why: Agent Hub's "arrange floating windows" places this panel alongside its mirrors.
  useFloatingWorkspacePlaceRequests((nextBounds) => {
    if (!maximized) {
      commitUserBounds(nextBounds)
    }
  })

  useEffect(() => {
    const handleResize = (): void => reconcileBounds()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [reconcileBounds])

  useEffect(() => {
    let cancelled = false
    void window.api.app.getFloatingTerminalCwd({ path: floatingTerminalCwd }).then((nextCwd) => {
      if (!cancelled) {
        // Publish the resolved directory once for every floating-workspace consumer, including row creation.
        setFloatingWorkspacePath(nextCwd)
      }
    })
    return () => {
      cancelled = true
    }
  }, [floatingTerminalCwd, setFloatingWorkspacePath])

  useEffect(() => {
    let cancelled = false
    void window.api.app.getFloatingMarkdownDirectory().then((nextMarkdownCwd) => {
      if (!cancelled) {
        setMarkdownCwd(nextMarkdownCwd)
      }
    })
    return () => {
      cancelled = true
    }
  }, [setMarkdownCwd])

  return { previewUserBounds, commitUserBounds }
}
