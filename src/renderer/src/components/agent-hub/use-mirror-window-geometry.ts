import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AgentHubMirrorSnapPreview } from './AgentHubMirrorSnapGhost'
import { dropPlan, sameMirrorBox, viewportSize } from './mirror-window-canvas-snap'
import { claimMirrorPlace, rememberLastMirrorSize } from './mirror-window-claim-place'
import { useMirrorSnapPreview } from './use-mirror-snap-preview'
import {
  clampAgentHubMirrorGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import {
  readAgentHubMirrorPlacement,
  requestAgentHubMirrorPlacements,
  useAgentHubArrangeVersion
} from './agent-hub-floating-arrangement'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import {
  keepAgentHubMirrorPlace,
  rememberAgentHubMirrorOrigin,
  setAgentHubMirrorPlaceFree
} from './agent-hub-mirror-places'
import type { AgentHubMirrorFocusState } from './agent-hub-mirror-focus'
import { useMirrorWindowFocus } from './use-mirror-window-focus'
import { usePrefersReducedMotion } from '@/hooks/theme/usePrefersReducedMotion'
import { glideMirrorWindow } from './mirror-window-glide'
import {
  claimAgentHubMirrorGesture,
  releaseAgentHubMirrorGesture,
  isAgentHubMirrorWindowDragTarget
} from './agent-hub-mirror-gesture'

const SETTLE_MS = 340
const MOVE_THRESHOLD_PX = 3

type DragState = {
  mode: 'move' | 'resize'
  /** A move captures the pointer only once it travels, so a double-click still reaches the title. */
  captured: boolean
  pointerX: number
  pointerY: number
  start: AgentHubMirrorGeometry
  next: AgentHubMirrorGeometry
  /** Option/Alt held: free placement, no snapping and no neighbours adapting. */
  altKey: boolean
}

/**
 * A mirror window's place and size. Why a transform while moving: re-laying out a window that
 * holds a live terminal on every pointer move stutters; the GPU slides it and the new spot is
 * committed on release. Resizing must re-lay out, so it is applied once per frame.
 * While the mirror is focused it shows in the focus box instead; its own place is kept as it was.
 */
export function useMirrorWindowGeometry(
  key: string,
  /** The hub's panel is open: a new mirror opens beside it, not under it. */
  besideHubPanel: boolean
): {
  geometry: AgentHubMirrorGeometry
  focus: AgentHubMirrorFocusState
  /** True briefly after the windows are arranged or a focus starts or ends, so the move can glide. */
  settling: boolean
  /** On the canvas while dragging or resizing: where the window will land. */
  snapPreview: AgentHubMirrorSnapPreview | null
  sectionRef: React.RefObject<HTMLElement | null>
  beginDrag: (mode: DragState['mode']) => (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  endDrag: (event: React.PointerEvent<HTMLElement>) => void
  cancelDrag: () => void
} {
  const [geometry, setGeometry] = useState<AgentHubMirrorGeometry>(() =>
    claimMirrorPlace(key, besideHubPanel)
  )
  const sectionRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)
  const { snapPreview, schedulePreview, clearPreview } = useMirrorSnapPreview(key, dragRef)
  const cancelDrag = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag) {
      releaseAgentHubMirrorGesture('window')
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }
    frameRef.current = null
    clearPreview()
    if (sectionRef.current) {
      sectionRef.current.style.translate = ''
    }
    if (drag?.mode === 'resize') {
      setGeometry(drag.start)
    }
  }, [clearPreview])
  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && dragRef.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
        cancelDrag()
      }
    }
    document.addEventListener('keydown', escape, true)
    const releasePending = (): void => {
      if (dragRef.current && !dragRef.current.captured) {
        cancelDrag()
      }
    }
    document.addEventListener('pointerup', releasePending)
    document.addEventListener('pointercancel', cancelDrag)
    window.addEventListener('blur', cancelDrag)
    return () => {
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('pointerup', releasePending)
      document.removeEventListener('pointercancel', cancelDrag)
      window.removeEventListener('blur', cancelDrag)
      cancelDrag()
    }
  }, [cancelDrag])
  // "Arrange floating windows" hands each mirror a new place.
  const arrangeVersion = useAgentHubArrangeVersion()
  const [seenArrangeVersion, setSeenArrangeVersion] = useState(arrangeVersion)
  const [settling, setSettling] = useState(false)
  if (arrangeVersion !== seenArrangeVersion) {
    setSeenArrangeVersion(arrangeVersion)
    const placement = readAgentHubMirrorPlacement(key)
    if (placement) {
      setGeometry(clampAgentHubMirrorGeometry(placement, viewportSize(), placement))
      setSettling(true)
    }
  }
  const focus = useMirrorWindowFocus(key)
  const focused = focus.box !== null
  const [seenFocused, setSeenFocused] = useState(focused)
  if (focused !== seenFocused) {
    setSeenFocused(focused)
    setSettling(true)
  }
  useEffect(() => {
    if (!settling) {
      return
    }
    const timer = setTimeout(() => setSettling(false), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [settling])

  const shownGeometry = focus.box ?? geometry
  const reducedMotion = usePrefersReducedMotion()
  const shownBefore = useRef(shownGeometry)
  const glide = useRef<Animation | null>(null)
  // Why a transform and not a width/height transition: the final box is laid out once, so the
  // live terminal inside refits once instead of reflowing on every frame. Drags never glide.
  useLayoutEffect(() => {
    const before = shownBefore.current
    shownBefore.current = shownGeometry
    if (!settling || reducedMotion || !sectionRef.current || sameMirrorBox(before, shownGeometry)) {
      return
    }
    glide.current?.cancel()
    glide.current = glideMirrorWindow(sectionRef.current, before, shownGeometry)
  }, [shownGeometry, settling, reducedMotion])
  useEffect(() => () => glide.current?.cancel(), [])

  // The committed spot replaces the slide in the same frame, so nothing jumps.
  useLayoutEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.style.translate = ''
    }
    rememberAgentHubMirrorOrigin(key, geometry)
  }, [geometry, key])

  useEffect(() => {
    // Why not on the canvas: its one settle pass moves all windows together.
    const onResize = (): void => {
      if (!isAgentHubCanvasOpen()) {
        setGeometry((current) => clampAgentHubMirrorGeometry(current, viewportSize()))
      }
    }
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
        // A focused mirror stays put: a drag would move the place it returns to.
        if (
          event.button !== 0 ||
          (mode === 'move' && !isAgentHubMirrorWindowDragTarget(event.target)) ||
          focused ||
          !claimAgentHubMirrorGesture('window', event.pointerId)
        ) {
          return
        }
        if (mode === 'resize') {
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        dragRef.current = {
          mode,
          captured: mode === 'resize',
          pointerX: event.clientX,
          pointerY: event.clientY,
          start: geometry,
          next: geometry,
          altKey: event.altKey
        }
      },
    [geometry, focused]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      drag.altKey = event.altKey
      const dx = event.clientX - drag.pointerX
      const dy = event.clientY - drag.pointerY
      if (!drag.captured && event.buttons === 0) {
        // The button came up outside the title bar before the pointer was captured.
        dragRef.current = null
        releaseAgentHubMirrorGesture('window')
        return
      }
      if (!drag.captured) {
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) {
          return
        }
        drag.captured = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (drag.mode === 'move') {
        drag.next = clampAgentHubMirrorGeometry(
          { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy },
          viewportSize()
        )
        if (sectionRef.current) {
          sectionRef.current.style.translate = `${drag.next.x - drag.start.x}px ${drag.next.y - drag.start.y}px`
        }
        schedulePreview()
        return
      }
      drag.next = clampAgentHubMirrorGeometry(
        { ...drag.start, width: drag.start.width + dx, height: drag.start.height + dy },
        viewportSize()
      )
      schedulePreview()
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null
          const pending = dragRef.current
          if (pending?.mode === 'resize') {
            setGeometry(pending.next)
          }
        })
      }
    },
    [schedulePreview]
  )

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      dragRef.current = null
      if (drag.captured) {
        releaseAgentHubMirrorGesture('window')
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        const plan = dropPlan(key, drag)
        if (plan || (drag.altKey && isAgentHubCanvasOpen())) {
          setAgentHubMirrorPlaceFree(key, !plan)
        }
        if (plan) {
          // The drop glides from where the pointer left the window to its dots.
          shownBefore.current = drag.next
          setSettling(true)
          if (plan.neighbours.size > 0) {
            requestAgentHubMirrorPlacements(plan.neighbours)
          }
        }
        setGeometry(plan?.target ?? drag.next)
        keepAgentHubMirrorPlace(key)
        if (drag.mode === 'resize') {
          const landed = plan?.target ?? drag.next
          rememberLastMirrorSize({ width: landed.width, height: landed.height })
        }
      }
      releaseAgentHubMirrorGesture('window')
    },
    [key]
  )

  return {
    geometry: shownGeometry,
    focus: focus.state,
    settling,
    snapPreview,
    sectionRef,
    beginDrag,
    onPointerMove,
    endDrag,
    cancelDrag
  }
}
