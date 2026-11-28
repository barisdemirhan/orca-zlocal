import { useAppStore } from '@/store'
import { useAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { useViewportSize } from './use-viewport-size'

/** Changes with what `agentHubWorkArea()` reads from the window, the shell and the canvas. */
export function useAgentHubWorkAreaKey(): string {
  const { width, height } = useViewportSize()
  const canvasOpen = useAgentHubCanvasOpen()
  const shell = useAppStore(
    (s) =>
      `${s.sidebarOpen}:${s.sidebarWidth}:${s.rightSidebarOpen}:${s.rightSidebarWidth}:${s.statusBarVisible}`
  )
  return `${width}x${height}:${canvasOpen}:${shell}`
}
