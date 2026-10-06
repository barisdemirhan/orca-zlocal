import { useContext, useLayoutEffect } from 'react'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import { captureScrollState, restoreScrollStateAfterLayout } from '@/lib/pane-manager/pane-scroll'
import { RetainedPaneMoveContext } from '../tab-group/retained-pane-move'

export function useTerminalRetainedHostScroll(
  managerRef: React.RefObject<PaneManager | null>
): void {
  const participants = useContext(RetainedPaneMoveContext)
  useLayoutEffect(() => {
    if (!participants) {
      return
    }
    // Why: reparenting can move the viewport before the existing fit captures its content marker.
    const capture = (): (() => void) => {
      const snapshots = (managerRef.current?.getPanes() ?? []).map((pane) => ({
        terminal: pane.terminal,
        scroll: captureScrollState(pane.terminal)
      }))
      return () =>
        snapshots.forEach(({ terminal, scroll }) => restoreScrollStateAfterLayout(terminal, scroll))
    }
    participants.add(capture)
    return () => {
      participants.delete(capture)
    }
  }, [managerRef, participants])
}
