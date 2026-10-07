import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { TabDragPointerSensor } from '../tab-group/tab-drag-pointer-sensor'
import { getDragPointer } from '../tab-group/tab-drag-pointer'
import { useTabDragGestureLifecycle } from '../tab-group/tab-drag-gesture-lifecycle'
import { getTabDragActivationDistance } from '../tab-group/useTabDragSplit'
import { isAgentHubMirrorTabDrag, type AgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'
import {
  currentMirrorDragEntry,
  mirrorStripDropAtPoint,
  type MirrorStripDrop
} from './agent-hub-mirror-drop-target'
import { commitMirrorTabDrop } from './agent-hub-mirror-drag-commit'
import {
  agentHubMirrorGestureOwner,
  releaseAgentHubMirrorGesture
} from './agent-hub-mirror-gesture'
import { subscribeAgentHubMirrors } from './agent-hub-mirror-store'

export function useAgentHubMirrorTabDrag(enabled: boolean) {
  const [active, setActive] = useState<AgentHubMirrorTabDrag | null>(null)
  const activeRef = useRef<AgentHubMirrorTabDrag | null>(null)
  const pointRef = useRef<{ x: number; y: number } | null>(null)
  const [drop, setDrop] = useState<MirrorStripDrop | null>(null)
  const isTabDragActiveRef = useRef(false)
  const clearDragStateRef = useRef<() => void>(() => {})
  const lifecycle = useTabDragGestureLifecycle({
    clearDragStateRef,
    tabDragActiveRef: isTabDragActiveRef
  })
  const { releaseMissedEndFallback, releaseWebviewDragPassthrough } = lifecycle
  const clear = useCallback(() => {
    isTabDragActiveRef.current = false
    activeRef.current = null
    pointRef.current = null
    releaseAgentHubMirrorGesture('tab')
    releaseMissedEndFallback()
    releaseWebviewDragPassthrough()
    setActive(null)
    setDrop(null)
  }, [releaseMissedEndFallback, releaseWebviewDragPassthrough])
  clearDragStateRef.current = clear
  const cancel = useCallback(() => {
    if (agentHubMirrorGestureOwner() === 'tab') {
      // The shared sensor owns its document listeners even before distance activation.
      document.dispatchEvent(new Event('pointercancel'))
    }
    clear()
  }, [clear])
  const options = useMemo(
    () => ({ activationConstraint: { distance: getTabDragActivationDistance(enabled) } }),
    [enabled]
  )
  const sensors = useSensors(useSensor(TabDragPointerSensor, options))

  useEffect(() => {
    if (!enabled) {
      cancel()
    }
  }, [enabled, cancel])
  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && agentHubMirrorGestureOwner() === 'tab') {
        event.preventDefault()
        event.stopImmediatePropagation()
        cancel()
      }
    }
    const lost = (): void => {
      if (agentHubMirrorGestureOwner() === 'tab') {
        cancel()
      }
    }
    const released = (): void => {
      if (!isTabDragActiveRef.current) {
        releaseAgentHubMirrorGesture('tab')
      }
    }
    const missedMove = (event: PointerEvent): void => {
      if (event.buttons === 0 && isTabDragActiveRef.current) {
        cancel()
      }
    }
    document.addEventListener('keydown', escape, true)
    document.addEventListener('lostpointercapture', lost)
    document.addEventListener('pointerup', released)
    document.addEventListener('pointermove', missedMove)
    const stop = subscribeAgentHubMirrors(() => {
      if (activeRef.current && !currentMirrorDragEntry(activeRef.current)) {
        cancel()
      }
    })
    const observer = new MutationObserver(() => {
      if (
        agentHubMirrorGestureOwner() === 'tab' &&
        document.querySelector('[data-slot="dialog-overlay"]')
      ) {
        cancel()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('lostpointercapture', lost)
      document.removeEventListener('pointerup', released)
      document.removeEventListener('pointermove', missedMove)
      stop()
      observer.disconnect()
      cancel()
    }
  }, [cancel])

  const resolveDrop = useCallback(
    (point: { x: number; y: number } | null): MirrorStripDrop | null => {
      const target = point ? mirrorStripDropAtPoint(point) : null
      return target?.windowId === activeRef.current?.windowId ? target : null
    },
    []
  )
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (!isAgentHubMirrorTabDrag(args.active.data.current)) {
        return []
      }
      const target = resolveDrop(args.pointerCoordinates)
      return target ? [{ id: `mirror-strip:${target.windowId}` }] : []
    },
    [resolveDrop]
  )
  const onDragStart = (event: DragStartEvent): void => {
    const payload = event.active.data.current
    if (
      !enabled ||
      document.querySelector('[data-slot="dialog-overlay"]') ||
      !isAgentHubMirrorTabDrag(payload) ||
      !currentMirrorDragEntry(payload)
    ) {
      cancel()
      return
    }
    activeRef.current = payload
    isTabDragActiveRef.current = true
    setActive(payload)
    lifecycle.installMissedEndFallback()
    lifecycle.acquireWebviewDragPassthrough()
  }
  const onDragMove = (event: DragMoveEvent): void => {
    if (isTabDragActiveRef.current) {
      pointRef.current = getDragPointer(event)
      setDrop(resolveDrop(pointRef.current))
    }
  }
  useEffect(() => {
    const scrolled = (): void => {
      if (isTabDragActiveRef.current) {
        setDrop(resolveDrop(pointRef.current))
      }
    }
    document.addEventListener('scroll', scrolled, true)
    return () => document.removeEventListener('scroll', scrolled, true)
  }, [resolveDrop])
  const onDragEnd = (event: DragEndEvent): void => {
    const payload = activeRef.current
    const target = enabled && isTabDragActiveRef.current ? resolveDrop(getDragPointer(event)) : null
    // Clear before publishing membership so subscriber revalidation cannot cancel a completed gesture.
    clear()
    if (payload && target) {
      commitMirrorTabDrop(payload, target)
    }
  }
  return {
    active,
    drop,
    sensors,
    isTabDragActiveRef,
    collisionDetection,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel: clear,
    onDragAbort: clear,
    setDragRootNode: lifecycle.setDragRootNode
  }
}
