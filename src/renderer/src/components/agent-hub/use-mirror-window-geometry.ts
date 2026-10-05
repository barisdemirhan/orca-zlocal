import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  agentHubMirrorOpenGeometry,
  agentHubMirrorOpenRegion,
  clampAgentHubMirrorGeometry,
  defaultAgentHubMirrorSize,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import {
  agentHubWorkArea,
  readAgentHubMirrorPlacement,
  useAgentHubArrangeVersion
} from './agent-hub-floating-arrangement'
import {
  keepAgentHubMirrorPlace,
  readAgentHubMirrorOrigin,
  rememberAgentHubMirrorOrigin
} from './agent-hub-mirror-places'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubMirrorFocusState } from './agent-hub-mirror-focus'
import { agentHubPaneTargetKey } from './agent-hub-pane-target'
import { useMirrorWindowFocus } from './use-mirror-window-focus'

const SETTLE_MS = 340
const MOVE_THRESHOLD_PX = 3

// Why module scope: a new mirror opens at the size the user last gave one this session.
let lastResizedTo: { width: number; height: number } | null = null

type DragState = {
  mode: 'move' | 'resize'
  /** A move captures the pointer only once it travels, so a double-click still reaches the title. */
  captured: boolean
  pointerX: number
  pointerY: number
  start: AgentHubMirrorGeometry
  next: AgentHubMirrorGeometry
}

function viewportSize(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * A window's first place: where it stood before (see readAgentHubMirrorOrigin), else centred in the work area (beside the hub's
 * panel while that is open), stepping off the mirrors already open. The place is remembered at
 * once, so windows opening in the same commit step off each other too; asking again returns it.
 */
function claimMirrorPlace(key: string, besideHubPanel: boolean): AgentHubMirrorGeometry {
  const viewport = viewportSize()
  const remembered = readAgentHubMirrorOrigin(key)
  if (remembered) {
    return clampAgentHubMirrorGeometry(remembered, viewport)
  }
  const panel = besideHubPanel
    ? document.querySelector('[data-agent-hub-panel]')?.getBoundingClientRect()
    : null
  const taken = readAgentHubMirrors().windows.flatMap(
    (open) => readAgentHubMirrorOrigin(agentHubPaneTargetKey(open)) ?? []
  )
  const place = clampAgentHubMirrorGeometry(
    agentHubMirrorOpenGeometry(
      lastResizedTo ?? defaultAgentHubMirrorSize(viewport),
      agentHubMirrorOpenRegion(agentHubWorkArea(), panel ?? null),
      taken
    ),
    viewport
  )
  rememberAgentHubMirrorOrigin(key, place)
  return place
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
  sectionRef: React.RefObject<HTMLElement | null>
  beginDrag: (mode: DragState['mode']) => (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  endDrag: (event: React.PointerEvent<HTMLElement>) => void
} {
  const [geometry, setGeometry] = useState<AgentHubMirrorGeometry>(() =>
    claimMirrorPlace(key, besideHubPanel)
  )
  const sectionRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)
  // "Arrange floating windows" hands each mirror a new place.
  const arrangeVersion = useAgentHubArrangeVersion()
  const [seenArrangeVersion, setSeenArrangeVersion] = useState(arrangeVersion)
  const [settling, setSettling] = useState(false)
  if (arrangeVersion !== seenArrangeVersion) {
    setSeenArrangeVersion(arrangeVersion)
    const placement = readAgentHubMirrorPlacement(key)
    if (placement) {
      setGeometry(clampAgentHubMirrorGeometry(placement, viewportSize()))
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

  // The committed spot replaces the slide in the same frame, so nothing jumps.
  useLayoutEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.style.translate = ''
    }
    rememberAgentHubMirrorOrigin(key, geometry)
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
        // A focused mirror stays put: a drag would move the place it returns to.
        if (event.button !== 0 || (mode === 'move' && onButton) || focused) {
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
          next: geometry
        }
      },
    [geometry, focused]
  )

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY
    if (!drag.captured && event.buttons === 0) {
      // The button came up outside the title bar before the pointer was captured.
      dragRef.current = null
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

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      dragRef.current = null
      if (drag.captured) {
        event.currentTarget.releasePointerCapture(event.pointerId)
        setGeometry(drag.next)
        keepAgentHubMirrorPlace(key)
        if (drag.mode === 'resize') {
          lastResizedTo = { width: drag.next.width, height: drag.next.height }
        }
      }
    },
    [key]
  )

  return {
    geometry: focus.box ?? geometry,
    focus: focus.state,
    settling,
    sectionRef,
    beginDrag,
    onPointerMove,
    endDrag
  }
}
