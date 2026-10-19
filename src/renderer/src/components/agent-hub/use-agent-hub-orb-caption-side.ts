import { useLayoutEffect, useRef, useState } from 'react'
import {
  AGENT_HUB_ORB_CARD_GAP,
  placeAgentHubOrbRequest,
  type AgentHubOrbSide
} from './agent-hub-orb-geometry'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'

export function useAgentHubOrbCaptionSide({ open, compact }: { open: boolean; compact: boolean }) {
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const [text, setText] = useState<HTMLDivElement | null>(null)
  const previousSide = useRef<AgentHubOrbSide>('right')
  const [position, setPosition] = useState<{ side: AgentHubOrbSide; sideOffset: number }>({
    side: 'right',
    sideOffset: AGENT_HUB_ORB_CARD_GAP
  })

  useLayoutEffect(() => {
    if (!open || compact || !anchor) {
      return
    }
    const stage = anchor.closest('[data-agent-hub-orb-stage]')
    let frame = 0
    const measure = (): void => {
      frame = 0
      const box = anchor.getBoundingClientRect()
      const protectedBox = stage?.getBoundingClientRect() ?? box
      const height = content
        ? content.offsetHeight + (text ? text.scrollHeight - text.clientHeight : 0)
        : 160
      const placement = placeAgentHubOrbRequest({
        anchor: {
          x: protectedBox.x,
          y: protectedBox.y,
          width: protectedBox.width,
          height: protectedBox.height
        },
        bounds: readAgentHubOrbBounds(),
        desiredSize: { width: 320, height: Math.min(256, height) },
        previousSide: previousSide.current
      })
      const nextSide = placement?.side ?? 'top'
      const clearance = {
        right: protectedBox.right - box.right,
        left: box.left - protectedBox.left,
        top: box.top - protectedBox.top,
        bottom: protectedBox.bottom - box.bottom
      }
      // Radix anchors to the sphere; the selected side must clear the whole control stage.
      const sideOffset = AGENT_HUB_ORB_CARD_GAP + Math.max(0, clearance[nextSide])
      previousSide.current = nextSide
      setPosition((current) =>
        current.side === nextSide && current.sideOffset === sideOffset
          ? current
          : { side: nextSide, sideOffset }
      )
    }
    const schedule = (): void => {
      if (!frame) {
        frame = requestAnimationFrame(measure)
      }
    }
    const dock = document.querySelector('[data-agent-hub-dock]')
    const resize = new ResizeObserver(schedule)
    for (const element of [anchor, stage, content, text, dock]) {
      if (element) {
        resize.observe(element)
      }
    }
    const mutations = new MutationObserver(schedule)
    for (const element of [stage, dock]) {
      if (element) {
        mutations.observe(element, { attributes: true, attributeFilter: ['style', 'data-edge'] })
      }
    }
    if (text) {
      mutations.observe(text, { childList: true, characterData: true, subtree: true })
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    measure()
    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      resize.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [open, compact, anchor, content, text])

  const preferredSide: AgentHubOrbSide = compact ? 'top' : position.side
  return {
    anchorRef: setAnchor,
    contentRef: setContent,
    textRef: setText,
    side: preferredSide,
    sideOffset: compact ? AGENT_HUB_ORB_CARD_GAP : position.sideOffset
  }
}
