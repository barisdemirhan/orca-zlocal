import { useEffect, useLayoutEffect, useRef } from 'react'
import { isAgentHubCanvasLeaveClick } from './agent-hub-canvas-sidebar-leave'
import {
  closeAgentHubCanvas,
  openAgentHubCanvas,
  useAgentHubCanvasOpen
} from './agent-hub-canvas-store'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import { agentHubPaneTargetKey } from './agent-hub-pane-target'

const NO_KEYS: ReadonlySet<string> = new Set()

/**
 * Runs the canvas for the hub. While its setting is on, a mirror window that opens (from the
 * hub, an alert, the tray, the mirrors button) shows the canvas, so none floats over the
 * workspace, and a click in the left sidebar on the place it covers leaves it. Returns whether
 * the canvas is showing.
 */
export function useAgentHubCanvas(enabled: boolean): boolean {
  const open = useAgentHubCanvasOpen()
  const { windows } = useAgentHubMirrors()
  const seenKeys = useRef(NO_KEYS)
  // Why layout: the canvas must be up in the frame the mirror appears, not the one after.
  useLayoutEffect(() => {
    // Off, nothing counts as seen: turning the setting on takes floating mirrors in.
    const keys = enabled ? new Set(windows.map(agentHubPaneTargetKey)) : NO_KEYS
    const opened = [...keys].some((key) => !seenKeys.current.has(key))
    seenKeys.current = keys
    if (opened) {
      openAgentHubCanvas()
    }
  }, [enabled, windows])
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
