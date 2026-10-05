import { useEffect } from 'react'
import {
  endAgentHubMirrorFocus,
  isAgentHubMirrorFocusEscape,
  useAgentHubMirrorFocus
} from './agent-hub-mirror-focus'

/**
 * The shadow over what is not the focused mirror: one on each other mirror, one on the canvas.
 * While shown it takes the clicks meant for what it covers, and a click on it ends the focus.
 */
export function AgentHubMirrorFocusShade({
  layer,
  shown
}: {
  /** `mirror` covers a mirror's terminal and chrome; `canvas` stays under the canvas's controls. */
  layer: 'mirror' | 'canvas'
  shown: boolean
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      data-agent-hub-focus-shade={layer}
      data-shown={shown}
      // Why preventDefault: a click on the shadow must not pull focus off the terminal typed in.
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={endAgentHubMirrorFocus}
      className="pointer-events-none absolute inset-0 bg-black/45 opacity-0 transition-opacity duration-200 data-[agent-hub-focus-shade=mirror]:z-30 data-[shown=true]:pointer-events-auto data-[shown=true]:opacity-100"
    />
  )
}

/** The canvas's own shadow; while a mirror is focused, Escape outside a terminal ends the focus. */
export function AgentHubCanvasFocusShade(): React.JSX.Element {
  const focused = useAgentHubMirrorFocus() !== null
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
  return <AgentHubMirrorFocusShade layer="canvas" shown={focused} />
}
