import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'

const GLIDE_MS = 200

/**
 * Slides and scales a window from its previous box to the one it now has, as a transform only.
 * The caller has already laid the window out at the final size, so nothing reflows per frame.
 */
export function glideMirrorWindow(
  element: HTMLElement,
  from: AgentHubMirrorGeometry,
  to: AgentHubMirrorGeometry
): Animation | null {
  if (typeof element.animate !== 'function' || to.width <= 0 || to.height <= 0) {
    return null
  }
  const start = `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(${from.width / to.width}, ${
    from.height / to.height
  })`
  // Why origin in the keyframes: the scale is measured from the top-left corner, and an inline
  // origin would be cleared by the previous glide's cancel event, which arrives after this starts.
  const animation = element.animate(
    [
      { transform: start, transformOrigin: '0 0' },
      { transform: 'none', transformOrigin: '0 0' }
    ],
    { duration: GLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  )
  // A cancelled glide rejects `finished`; nobody awaits it.
  animation.finished?.catch(() => {})
  return animation
}
