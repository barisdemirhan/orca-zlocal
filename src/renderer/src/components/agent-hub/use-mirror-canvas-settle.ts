import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { settleCanvasMirrors } from './agent-hub-canvas-dot-snap'
import { requestAgentHubMirrorPlacements } from './agent-hub-floating-arrangement'
import { useViewportSize } from './use-viewport-size'
import { useAgentHubMirrors } from './agent-hub-mirror-store'

/**
 * The one owner of the canvas's layout: when the canvas opens, a mirror opens or closes, or the
 * sidebar, dock or window changes the area, every open mirror is settled together so none lands
 * on another.
 */
export function useAgentHubCanvasSettle(): void {
  const canvasOpen = useAgentHubCanvasOpen()
  const shellKey = useAppStore((s) => `${s.sidebarOpen}:${s.sidebarWidth}:${s.statusBarVisible}`)
  const { width, height } = useViewportSize()
  const openKeys = useAgentHubMirrors()
    .windows.map((open) => open.id)
    .join('\n')
  const settledKeys = useRef<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!canvasOpen) {
      settledKeys.current = new Set()
      return
    }
    const settle = (): void => {
      const keys = new Set(openKeys ? openKeys.split('\n') : [])
      const known = settledKeys.current
      settledKeys.current = keys
      const fresh = new Set([...keys].filter((key) => !known.has(key)))
      const moves = settleCanvasMirrors(fresh)
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
  }, [canvasOpen, shellKey, width, height, openKeys])
}
