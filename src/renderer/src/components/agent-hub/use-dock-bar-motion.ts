import { useLayoutEffect, useRef, useState } from 'react'
import type { AgentHubDockEdge } from '../../../../shared/agent-hub-settings'
import { paintAgentHubNotch } from './AgentHubDockParts'

const GROW_MS = 320
const SHRINK_MS = 260

type Size = { width: number; height: number }

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

type Motion = {
  /** What is on screen right now, mid-glide included. */
  shown: Size | null
  frame: number | null
  edge: AgentHubDockEdge
}

function show(motion: Motion, notch: SVGSVGElement | null, next: Size): void {
  motion.shown = next
  if (notch) {
    paintAgentHubNotch(notch, motion.edge, next)
  }
}

function naturalSize(bar: HTMLElement): Size {
  bar.style.width = ''
  bar.style.height = ''
  return { width: bar.offsetWidth, height: bar.offsetHeight }
}

/**
 * Glides the dock bar between the notch and the hover bar, redrawing its outline in the same
 * frame. Why JS: both sizes come from content, which CSS cannot transition, and the outline is
 * an SVG path that has to move with the bar rather than a frame behind it.
 * Returns the settled size, for keeping the dock on screen.
 */
export function useDockBarMotion(
  barRef: React.RefObject<HTMLElement | null>,
  notchRef: React.RefObject<SVGSVGElement | null>,
  edge: AgentHubDockEdge,
  expanded: boolean
): Size | null {
  const [size, setSize] = useState<Size | null>(null)
  const motionRef = useRef<Motion>({ shown: null, frame: null, edge })

  useLayoutEffect(() => {
    const motion = motionRef.current
    motion.edge = edge
    const bar = barRef.current
    if (!bar) {
      return
    }
    const settle = (): void => {
      // The glide drives the size itself; a resize it causes is not a new resting size.
      if (motion.frame !== null) {
        return
      }
      const next = { width: bar.offsetWidth, height: bar.offsetHeight }
      show(motion, notchRef.current, next)
      setSize((current) =>
        current?.width === next.width && current.height === next.height ? current : next
      )
    }
    settle()
    const observer = new ResizeObserver(settle)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [barRef, notchRef, edge])

  useLayoutEffect(() => {
    const motion = motionRef.current
    const bar = barRef.current
    const from = motion.shown
    if (!bar || !from) {
      return
    }
    const to = naturalSize(bar)
    if (
      (from.width === to.width && from.height === to.height) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      show(motion, notchRef.current, to)
      return
    }
    // A toggle mid-glide starts from wherever the bar is now.
    const started = performance.now()
    const duration = expanded ? GROW_MS : SHRINK_MS
    const place = (current: Size): void => {
      bar.style.width = `${current.width}px`
      bar.style.height = `${current.height}px`
      show(motion, notchRef.current, current)
    }
    const step = (now: number): void => {
      const t = Math.min(1, (now - started) / duration)
      if (t >= 1) {
        motion.frame = null
        naturalSize(bar)
        show(motion, notchRef.current, to)
        setSize(to)
        return
      }
      const k = easeOutCubic(t)
      place({
        width: from.width + (to.width - from.width) * k,
        height: from.height + (to.height - from.height) * k
      })
      motion.frame = requestAnimationFrame(step)
    }
    place(from)
    motion.frame = requestAnimationFrame(step)
    return () => {
      if (motion.frame !== null) {
        cancelAnimationFrame(motion.frame)
        motion.frame = null
      }
    }
  }, [barRef, notchRef, expanded])

  return size
}
