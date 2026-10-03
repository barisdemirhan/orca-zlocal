import type { AgentHubAlertKind } from './agent-hub-alerts'

const SHAKE_MS = 420
const GLOW_MS = 1600

function stateColor(kind: AgentHubAlertKind): string {
  const token = kind === 'done' ? '--status-success' : '--agent-question'
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || 'currentColor'
}

/**
 * The open mirror's own alert, instead of a bubble from the hub: a short shake (an old messenger
 * "nudge") and a glow in the state's colour. Reduced motion keeps only the glow.
 */
export function nudgeMirrorWindow(element: HTMLElement, kind: AgentHubAlertKind): void {
  const color = stateColor(kind)
  const ring = (spread: number, alpha: number): string =>
    `0 0 0 ${spread}px color-mix(in srgb, ${color} ${alpha}%, transparent), 0 0 ${spread * 6}px color-mix(in srgb, ${color} ${alpha / 2}%, transparent)`
  element.animate(
    [
      { boxShadow: ring(0, 0) },
      { boxShadow: ring(4, 70), offset: 0.2 },
      { boxShadow: ring(2, 45), offset: 0.6 },
      { boxShadow: ring(0, 0) }
    ],
    { duration: GLOW_MS, easing: 'ease-out' }
  )
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  element.animate(
    [0, -6, 6, -4, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: SHAKE_MS, easing: 'ease-in-out' }
  )
}
