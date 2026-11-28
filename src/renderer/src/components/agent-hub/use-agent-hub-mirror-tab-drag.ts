import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { TabDragPointerSensor } from '../tab-group/drag/tab-drag-pointer-sensor'
import { getDragPointer } from '../tab-group/drag/tab-drag-pointer'
import { useTabDragGestureLifecycle } from '../tab-group/drag/tab-drag-gesture-lifecycle'
import { getTabDragActivationDistance } from '../tab-group/drag/useTabDragSplit'
import { isAgentHubMirrorTabDrag, type AgentHubMirrorTabDrag } from './agent-hub-mirror-drag-data'
import {
  currentMirrorDragEntry,
  mirrorTabDropAtPoint,
  type MirrorTabDrop
} from './agent-hub-mirror-drop-target'
import { commitMirrorTabDrop } from './agent-hub-mirror-drag-commit'
import {
  agentHubMirrorGestureOwner,
  blockAgentHubMirrorTabClick,
  isAgentHubMirrorTabClickBlocked,
  releaseAgentHubMirrorGesture
} from './agent-hub-mirror-gesture'
import { subscribeAgentHubMirrors, readAgentHubMirrors } from './agent-hub-mirror-store'
import { mirrorTabTransferFeedback } from './agent-hub-mirror-transfer-feedback'

export function useAgentHubMirrorTabDrag(enabled: boolean) {
  const [active, setActive] = useState<AgentHubMirrorTabDrag | null>(null)
  const activeRef = useRef<AgentHubMirrorTabDrag | null>(null)
  const pointRef = useRef<{ x: number; y: number } | null>(null)
  const [drop, setDrop] = useState<MirrorTabDrop | null>(null)
  const dropRef = useRef<MirrorTabDrop | null>(null)
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
    dropRef.current = null
    releaseAgentHubMirrorGesture('tab')
    releaseMissedEndFallback()
    releaseWebviewDragPassthrough()
    setActive(null)
    setDrop(null)
  }, [releaseMissedEndFallback, releaseWebviewDragPassthrough])
  const cancel = useCallback(() => {
    if (agentHubMirrorGestureOwner() === 'tab') {
      // The shared sensor owns its document listeners even before distance activation.
      document.dispatchEvent(new Event('pointercancel'))
    }
    clear()
  }, [clear])
  clearDragStateRef.current = cancel
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
    const click = (event: MouseEvent): void => {
      if (event.detail > 0 && isAgentHubMirrorTabClickBlocked()) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    const nextGesture = (): void => {
      if (!isTabDragActiveRef.current) {
        blockAgentHubMirrorTabClick(false)
      }
    }
    window.addEventListener('click', click, true)
    document.addEventListener('pointerdown', nextGesture, true)
    const stop = subscribeAgentHubMirrors(() => {
      if (activeRef.current && !currentMirrorDragEntry(activeRef.current)) {
        cancel()
      }
      const target = dropRef.current
      if (target?.kind === 'strip') {
        const window = readAgentHubMirrors().windows.find((item) => item.id === target.windowId)
        if (!window || (target.entryId && !window.tabs.some((tab) => tab.id === target.entryId))) {
          cancel()
        }
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
      window.removeEventListener('click', click, true)
      document.removeEventListener('pointerdown', nextGesture, true)
      blockAgentHubMirrorTabClick(false)
      stop()
      observer.disconnect()
      cancel()
    }
  }, [cancel])

  const resolveDrop = useCallback(
    (point: { x: number; y: number } | null): MirrorTabDrop | null => {
      return point ? mirrorTabDropAtPoint(point) : null
    },
    []
  )
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (!isAgentHubMirrorTabDrag(args.active.data.current)) {
        return []
      }
      const target = resolveDrop(args.pointerCoordinates)
      return target
        ? [{ id: target.kind === 'strip' ? `mirror-strip:${target.windowId}` : 'mirror-detach' }]
        : []
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
    blockAgentHubMirrorTabClick(true)
    isTabDragActiveRef.current = true
    setActive(payload)
    lifecycle.installMissedEndFallback()
    lifecycle.acquireWebviewDragPassthrough()
  }
  const onDragMove = (event: DragMoveEvent): void => {
    if (isTabDragActiveRef.current) {
      pointRef.current = getDragPointer(event)
      dropRef.current = resolveDrop(pointRef.current)
      setDrop(dropRef.current)
    }
  }
  useEffect(() => {
    const scrolled = (): void => {
      if (isTabDragActiveRef.current) {
        dropRef.current = resolveDrop(pointRef.current)
        setDrop(dropRef.current)
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
      mirrorTabTransferFeedback(commitMirrorTabDrop(payload, target))
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
