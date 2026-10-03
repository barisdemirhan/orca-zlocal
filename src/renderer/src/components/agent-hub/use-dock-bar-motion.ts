import { useLayoutEffect, useRef, useState } from 'react'

const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const GROW_MS = 220
const SHRINK_MS = 160

type Size = { width: number; height: number }

/**
 * Measures the dock bar (its outline and on-screen clamp follow its size) and glides it between
 * the notch and the hover bar. Why JS: both sizes come from content, which CSS cannot transition.
 */
export function useDockBarMotion(
  barRef: React.RefObject<HTMLElement | null>,
  expanded: boolean
): Size | null {
  const [size, setSize] = useState<Size | null>(null)
  const sizeRef = useRef<Size | null>(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) {
      return
    }
    const measure = (): void => {
      const next = { width: bar.offsetWidth, height: bar.offsetHeight }
      sizeRef.current = next
      setSize((current) =>
        current?.width === next.width && current.height === next.height ? current : next
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [barRef])

  useLayoutEffect(() => {
    const bar = barRef.current
    const from = sizeRef.current
    if (!bar || !from) {
      return
    }
    // A toggle mid-glide starts from where the bar is now, toward its new natural size.
    bar.getAnimations().forEach((animation) => animation.cancel())
    const to = { width: bar.offsetWidth, height: bar.offsetHeight }
    if (
      (from.width === to.width && from.height === to.height) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    bar.animate(
      [
        { width: `${from.width}px`, height: `${from.height}px` },
        { width: `${to.width}px`, height: `${to.height}px` }
      ],
      { duration: expanded ? GROW_MS : SHRINK_MS, easing: EASING }
    )
  }, [barRef, expanded])

  return size
}
