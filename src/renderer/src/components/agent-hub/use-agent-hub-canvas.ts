import { useEffect, useLayoutEffect } from 'react'
import { isAgentHubCanvasLeaveClick } from './agent-hub-canvas-sidebar-leave'
import { closeAgentHubCanvas, useAgentHubCanvasOpen } from './agent-hub-canvas-store'

/** Mirrors share one set; only an explicit canvas action changes the view. */
export function useAgentHubCanvas(enabled: boolean): boolean {
  const open = useAgentHubCanvasOpen()
  // The setting turned off, or the hub left the screen.
  useLayoutEffect(() => (enabled ? closeAgentHubCanvas : undefined), [enabled])
  const shown = enabled && open
  useEffect(() => {
    if (!shown) {
      return
    }
    const onClick = (event: MouseEvent): void => {
      if (isAgentHubCanvasLeaveClick(event)) {
        closeAgentHubCanvas()
      }
    }
    // Why capture: a row that stops the click from bubbling must still be heard.
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [shown])
  return shown
}
