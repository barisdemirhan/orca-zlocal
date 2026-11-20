import { useEffect, useRef, useState } from 'react'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'

// The panel's footprint when full: its fixed width and its tallest height.
const PANEL_WIDTH = 608
const PANEL_MAX_HEIGHT = 640

export type AgentHubPopoverOffsets = { sideOffset: number; alignOffset: number }

/**
 * Offsets that put a panel hanging off `dock` (on `side` of it, start-aligned) in the middle of
 * the work area. Why start-aligned: an alignment offset has no effect on a centred popover.
 */
function centredOffsets(
  dock: DOMRect,
  side: 'top' | 'bottom' | 'left' | 'right',
  height: number
): AgentHubPopoverOffsets {
  const area = agentHubWorkArea()
  const left = area.left + area.width / 2 - PANEL_WIDTH / 2
  const top = area.top + area.height / 2 - height / 2
  switch (side) {
    case 'top':
      return { sideOffset: Math.max(12, dock.top - (top + height)), alignOffset: left - dock.left }
    case 'bottom':
      return { sideOffset: Math.max(12, top - dock.bottom), alignOffset: left - dock.left }
    case 'right':
      return { sideOffset: Math.max(12, left - dock.right), alignOffset: top - dock.top }
    case 'left':
      return {
        sideOffset: Math.max(12, dock.left - (left + PANEL_WIDTH)),
        alignOffset: top - dock.top
      }
  }
}

/**
 * An empty canvas greets with the hub's Agents list in its middle, ready to pop terminals out.
 * Returns the offsets that centre the panel, kept until the hub closes so the rows do not move
 * under the pointer once the first mirror opens.
 */
export function useAgentHubCanvasWelcome({
  canvasOpen,
  empty,
  hubOpen,
  anchorRef,
  side,
  openAgents,
  closeHub
}: {
  canvasOpen: boolean
  /** No mirror window is open. */
  empty: boolean
  hubOpen: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  side: 'top' | 'bottom' | 'left' | 'right'
  openAgents: () => void
  closeHub: () => void
}): AgentHubPopoverOffsets | null {
  const [offsets, setOffsets] = useState<AgentHubPopoverOffsets | null>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    const entered = canvasOpen && !wasOpen.current
    const left = !canvasOpen && wasOpen.current
    wasOpen.current = canvasOpen
    // The greeting belongs to the canvas: leaving it takes the panel along.
    if (left && offsets) {
      closeHub()
      return
    }
    if (!entered || !empty || !anchorRef.current) {
      return
    }
    const dock = anchorRef.current.getBoundingClientRect()
    setOffsets(centredOffsets(dock, side, Math.min(PANEL_MAX_HEIGHT, window.innerHeight - 96)))
    openAgents()
    // The panel is only as tall as its list; centre on its real height once it has drawn.
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('[data-agent-hub-panel]')
      if (panel) {
        setOffsets(centredOffsets(dock, side, panel.offsetHeight))
      }
    })
    return () => cancelAnimationFrame(frame)
    // Why only the canvas: this greets on entering, not whenever the last mirror closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasOpen])
  // Closed, the hub goes back to hanging off its dock.
  if (!hubOpen && offsets) {
    setOffsets(null)
  }
  return offsets
}
