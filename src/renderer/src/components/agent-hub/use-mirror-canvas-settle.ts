import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { settleCanvasMirrors } from './agent-hub-canvas-dot-snap'
import { requestAgentHubMirrorPlacements } from './agent-hub-floating-arrangement'
import { useViewportSize } from './use-viewport-size'

/**
 * The one owner of the canvas's area changes: when the canvas opens or the sidebar, dock or window
 * changes the area, every open mirror is settled together so none lands on another.
 */
export function useAgentHubCanvasSettle(): void {
  const canvasOpen = useAgentHubCanvasOpen()
  const shellKey = useAppStore((s) => `${s.sidebarOpen}:${s.sidebarWidth}:${s.statusBarVisible}`)
  const { width, height } = useViewportSize()
  useEffect(() => {
    if (!canvasOpen) {
      return
    }
    const settle = (): void => {
      const moves = settleCanvasMirrors()
      if (moves.size > 0) {
        requestAgentHubMirrorPlacements(moves)
      }
    }
    settle()
    const dock = document.querySelector('[data-agent-hub-dock]')
    if (!dock) {
      return
    }
    const watch = new MutationObserver(settle)
    watch.observe(dock, { attributes: true, attributeFilter: ['data-edge'] })
    return () => watch.disconnect()
  }, [canvasOpen, shellKey, width, height])
}
