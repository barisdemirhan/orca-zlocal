import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentHubMirrorSnapPreview } from './AgentHubMirrorSnapGhost'
import { dropPlan, samePreview, type DragInput } from './mirror-window-canvas-snap'

/**
 * The ghost a drag or resize shows on the canvas: the landing box and the boxes of the mirrors it
 * displaces. Computed at most once per frame; holding Option/Alt turns it off.
 */
export function useMirrorSnapPreview(
  key: string,
  dragRef: React.RefObject<DragInput | null>
): {
  snapPreview: AgentHubMirrorSnapPreview | null
  schedulePreview: () => void
  clearPreview: () => void
} {
  const frameRef = useRef<number | null>(null)
  const [snapPreview, setSnapPreview] = useState<AgentHubMirrorSnapPreview | null>(null)
  const refresh = useCallback(() => {
    frameRef.current = null
    const drag = dragRef.current
    const plan = drag?.captured ? dropPlan(key, drag) : null
    const next = plan ? { target: plan.target, neighbours: [...plan.neighbours.values()] } : null
    setSnapPreview((current) => (samePreview(current, next) ? current : next))
  }, [key, dragRef])
  const schedulePreview = useCallback(() => {
    frameRef.current ??= requestAnimationFrame(refresh)
  }, [refresh])
  const clearPreview = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }
    frameRef.current = null
    setSnapPreview(null)
  }, [])
  useEffect(() => {
    const alt = (event: KeyboardEvent): void => {
      if (event.key === 'Alt' && dragRef.current) {
        dragRef.current.altKey = event.type === 'keydown'
        schedulePreview()
      }
    }
    document.addEventListener('keydown', alt)
    document.addEventListener('keyup', alt)
    return () => {
      document.removeEventListener('keydown', alt)
      document.removeEventListener('keyup', alt)
      clearPreview()
    }
  }, [dragRef, schedulePreview, clearPreview])
  return { snapPreview, schedulePreview, clearPreview }
}
