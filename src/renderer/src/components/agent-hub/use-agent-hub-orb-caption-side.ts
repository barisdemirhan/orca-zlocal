import { useLayoutEffect, useRef, useState } from 'react'
import {
  AGENT_HUB_ORB_CARD_GAP,
  placeAgentHubOrbRequest,
  type AgentHubOrbSide
} from './agent-hub-orb-geometry'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'

/** The organism canvas draws its visible sphere at this fraction of the anchor box (0.32 x 0.86). */
const VISIBLE_SPHERE_RADIUS = 0.32 * 0.86
/** A hidden pill rests 4px toward the sphere and slides out when it shows. */
const PILL_REVEAL_SHIFT = 4

type CaptionPosition = {
  side: AgentHubOrbSide
  sideOffset: number
  align: 'start' | 'end' | 'center'
  alignOffset: number
}

export function useAgentHubOrbCaptionSide({ open, compact }: { open: boolean; compact: boolean }) {
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const [text, setText] = useState<HTMLDivElement | null>(null)
  const previousSide = useRef<AgentHubOrbSide>('right')
  const [position, setPosition] = useState<CaptionPosition>({
    side: 'right',
    sideOffset: AGENT_HUB_ORB_CARD_GAP,
    align: 'end',
    alignOffset: 0
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
      // Why: the pill overflows the stage; the bubble keeps its space even while it is hidden, so it never jumps.
      const pill = stage?.querySelector('.agent-hub-orb-hover-controls')?.getBoundingClientRect()
      const stageBox = stage?.getBoundingClientRect() ?? box
      const protectedBox = pill
        ? {
            left: Math.min(stageBox.left, pill.left),
            top: Math.min(stageBox.top, pill.top - PILL_REVEAL_SHIFT),
            right: Math.max(stageBox.right, pill.right),
            bottom: Math.max(stageBox.bottom, pill.bottom + PILL_REVEAL_SHIFT)
          }
        : stageBox
      const height = content
        ? content.offsetHeight + (text ? text.scrollHeight - text.clientHeight : 0)
        : 160
      const inset = box.width * (0.5 - VISIBLE_SPHERE_RADIUS)
      const sphere = {
        x: box.x + inset,
        y: box.y + inset,
        width: box.width - inset * 2,
        height: box.height - inset * 2
      }
      const bounds = readAgentHubOrbBounds()
      const desiredSize = { width: 320, height: Math.min(256, height) }
      // A reply reads as the sphere speaking, so beside it wins whenever the bubble fits there in full.
      const room = {
        right: bounds.right - (sphere.x + sphere.width + AGENT_HUB_ORB_CARD_GAP),
        left: sphere.x - AGENT_HUB_ORB_CARD_GAP - bounds.left
      }
      const fitsBeside = (side: 'left' | 'right'): boolean =>
        room[side] >= desiredSize.width &&
        sphere.y + sphere.height - bounds.top >= desiredSize.height
      const besideOrder: ('left' | 'right')[] =
        previousSide.current === 'left' ? ['left', 'right'] : ['right', 'left']
      const pinned = stage?.getAttribute('data-pinned')
      const away = pinned ? stage?.getAttribute('data-away') : null
      // Why: beside a pinned sphere the bubble would cover the dock, so it opens away from the dock.
      const nextSide = pinned
        ? pinned === 'down'
          ? 'bottom'
          : 'top'
        : (besideOrder.find(fitsBeside) ??
          placeAgentHubOrbRequest({
            anchor: sphere,
            bounds,
            desiredSize,
            previousSide: previousSide.current
          })?.side ??
          'top')
      const beside = nextSide === 'left' || nextSide === 'right'
      const clearance = {
        right: protectedBox.right - box.right,
        left: box.left - protectedBox.left,
        top: box.top - protectedBox.top,
        bottom: protectedBox.bottom - box.bottom
      }
      // Radix anchors to the canvas box: beside the sphere only its transparent margin is cleared and the bubble's bottom meets the sphere's, so it grows upward and never covers the quick box; above or below, the whole control stage.
      const next: CaptionPosition = beside
        ? {
            side: nextSide,
            sideOffset: AGENT_HUB_ORB_CARD_GAP - inset,
            align: 'end',
            alignOffset: inset
          }
        : {
            side: nextSide,
            sideOffset: AGENT_HUB_ORB_CARD_GAP + Math.max(0, clearance[nextSide]),
            // Why: beside a top or bottom dock the bubble lines up with the sphere's far edge and grows away from the dock.
            ...(away === 'left'
              ? { align: 'end' as const, alignOffset: inset }
              : away === 'right'
                ? { align: 'start' as const, alignOffset: inset }
                : { align: 'center' as const, alignOffset: 0 })
          }
      previousSide.current = nextSide
      setPosition((current) =>
        current.side === next.side &&
        current.sideOffset === next.sideOffset &&
        current.align === next.align &&
        current.alignOffset === next.alignOffset
          ? current
          : next
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
        mutations.observe(element, {
          attributes: true,
          attributeFilter: ['style', 'data-edge', 'data-away', 'data-quick']
        })
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
    sideOffset: compact ? AGENT_HUB_ORB_CARD_GAP : position.sideOffset,
    align: compact ? ('center' as const) : position.align,
    alignOffset: compact ? 0 : position.alignOffset
  }
}
