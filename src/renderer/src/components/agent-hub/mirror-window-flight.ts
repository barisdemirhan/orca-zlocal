const FLIGHT_MS = 320
const FADE_MS = 140

/**
 * Flies a mirror window into the hub before it becomes a chip there: it shrinks toward the
 * hub's centre and fades. Without a hub on screen it just fades. Calls `land` once, at the end.
 */
export function flyMirrorWindowToHub(
  element: HTMLElement,
  hub: HTMLElement | null,
  land: () => void,
  delayMs = 0
): () => void {
  let landed = false
  const landOnce = (): void => {
    if (!landed) {
      landed = true
      land()
    }
  }
  const from = element.getBoundingClientRect()
  const to = hub?.getBoundingClientRect()
  const keyframes: Keyframe[] = to
    ? [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${
            to.top + to.height / 2 - (from.top + from.height / 2)
          }px) scale(0.06)`,
          opacity: 0
        }
      ]
    : [{ opacity: 1 }, { opacity: 0 }]
  try {
    const flight = element.animate(keyframes, {
      duration: to ? FLIGHT_MS : FADE_MS,
      delay: Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0,
      easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      // Why forwards: the window must not flash back at full size before React removes it.
      fill: 'forwards'
    })
    flight.onfinish = landOnce
    flight.oncancel = landOnce
    return () => flight.cancel()
  } catch {
    landOnce()
    return () => {}
  }
}
