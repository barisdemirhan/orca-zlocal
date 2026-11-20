import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store'
import { STATUS_BAR_RESERVE_HEIGHT } from '../../app-shell/chrome/workspace-chrome-metrics'
import {
  endAgentHubMirrorFocus,
  isAgentHubMirrorFocusEscape,
  useAgentHubMirrorFocus
} from './agent-hub-mirror-focus'

/**
 * The shadow over what is not the focused mirror: one on each other mirror, one on the canvas
 * or, off the canvas, on the workspace. While shown it takes the clicks meant for what it
 * covers, and a click on it ends the focus.
 */
export function AgentHubMirrorFocusShade({
  layer,
  shown,
  bottom
}: {
  /** `mirror` covers a mirror's terminal and chrome; `canvas` stays under the canvas's controls;
   *  `workspace` lies over the workspace, under the mirrors and the dock. */
  layer: 'mirror' | 'canvas' | 'workspace'
  shown: boolean
  /** Workspace layer: what stays lit at the bottom (the status bar). */
  bottom?: number
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      data-agent-hub-focus-shade={layer}
      data-shown={shown}
      style={bottom === undefined ? undefined : { bottom }}
      // Why preventDefault: a click on the shadow must not pull focus off the terminal typed in.
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={endAgentHubMirrorFocus}
      // The workspace shade covers the floating panel (45), below the focused mirrors (47).
      className="pointer-events-none absolute inset-0 bg-black/45 opacity-0 transition-opacity duration-200 data-[agent-hub-focus-shade=mirror]:z-30 data-[agent-hub-focus-shade=workspace]:fixed data-[agent-hub-focus-shade=workspace]:z-[46] data-[shown=true]:pointer-events-auto data-[shown=true]:opacity-100"
    />
  )
}

/** While a mirror is focused, Escape outside a terminal ends the focus. */
function useAgentHubMirrorFocusEscape(focused: boolean): void {
  useEffect(() => {
    if (!focused) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isAgentHubMirrorFocusEscape(event)) {
        // Why stopped: the same key on a mirror's chrome would otherwise close that mirror.
        event.preventDefault()
        event.stopPropagation()
        endAgentHubMirrorFocus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [focused])
}

/** The canvas's own shadow. */
export function AgentHubCanvasFocusShade(): React.JSX.Element {
  const focused = useAgentHubMirrorFocus() !== null
  useAgentHubMirrorFocusEscape(focused)
  return <AgentHubMirrorFocusShade layer="canvas" shown={focused} />
}

/** The workspace's shadow while a mirror is focused with the canvas closed. */
export function AgentHubWorkspaceFocusShade(): React.JSX.Element {
  const focused = useAgentHubMirrorFocus() !== null
  const statusBarHeight = useAppStore((s) => (s.statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0))
  useAgentHubMirrorFocusEscape(focused)
  return createPortal(
    <AgentHubMirrorFocusShade layer="workspace" shown={focused} bottom={statusBarHeight} />,
    document.body
  )
}
