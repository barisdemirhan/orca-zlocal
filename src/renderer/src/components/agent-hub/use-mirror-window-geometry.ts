import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { readAgentHubMirrorOrigin, rememberAgentHubMirrorOrigin } from './agent-hub-mirror-store'

const CASCADE_STEP_PX = 28

// Why module scope: a new mirror opens where the user last left one this session.
let lastGeometry: AgentHubMirrorGeometry | null = null

type DragState = {
  mode: 'move' | 'resize'
  pointerX: number
  pointerY: number
  start: AgentHubMirrorGeometry
  next: AgentHubMirrorGeometry
}

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * A mirror window's place and size. Why a transform while moving: re-laying out a window that
 * holds a live terminal on every pointer move stutters; the GPU slides it and the new spot is
 * committed on release. Resizing must re-lay out, so it is applied once per frame.
 */
export function useMirrorWindowGeometry(
  key: string,
  cascade: number
): {
  geometry: AgentHubMirrorGeometry
  sectionRef: React.RefObject<HTMLElement | null>
  beginDrag: (mode: DragState['mode']) => (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  endDrag: (event: React.PointerEvent<HTMLElement>) => void
} {
  const [geometry, setGeometry] = useState<AgentHubMirrorGeometry>(() => {
    const base = lastGeometry ?? defaultAgentHubMirrorGeometry(viewportSize())
    // A restored chip reopens where it was dragged to.
    const origin = readAgentHubMirrorOrigin(key)
    const step = CASCADE_STEP_PX * cascade
    return clampAgentHubMirrorGeometry(
      origin ? { ...base, ...origin } : { ...base, x: base.x - step, y: base.y - step },
      viewportSize()
    )
  })
  const sectionRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)

  // The committed spot replaces the slide in the same frame, so nothing jumps.
  useLayoutEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.style.translate = ''
    }
    lastGeometry = geometry
    rememberAgentHubMirrorOrigin(key, { x: geometry.x, y: geometry.y })
  }, [geometry, key])

  useEffect(() => {
    const onResize = (): void =>
      setGeometry((current) => clampAgentHubMirrorGeometry(current, viewportSize()))
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  const beginDrag = useCallback(
    (mode: DragState['mode']) =>
      (event: React.PointerEvent<HTMLElement>): void => {
        const onButton = event.target instanceof Element && event.target.closest('button') !== null
        if (event.button !== 0 || (mode === 'move' && onButton)) {
          return
        }
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = {
          mode,
          pointerX: event.clientX,
          pointerY: event.clientY,
          start: geometry,
          next: geometry
        }
      },
    [geometry]
  )

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY
    if (drag.mode === 'move') {
      drag.next = clampAgentHubMirrorGeometry(
        { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy },
        viewportSize()
      )
      if (sectionRef.current) {
        sectionRef.current.style.translate = `${drag.next.x - drag.start.x}px ${drag.next.y - drag.start.y}px`
      }
      return
    }
    drag.next = clampAgentHubMirrorGeometry(
      { ...drag.start, width: drag.start.width + dx, height: drag.start.height + dy },
      viewportSize()
    )
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        const pending = dragRef.current
        if (pending?.mode === 'resize') {
          setGeometry(pending.next)
        }
      })
    }
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    setGeometry(drag.next)
  }, [])

  return { geometry, sectionRef, beginDrag, onPointerMove, endDrag }
}
