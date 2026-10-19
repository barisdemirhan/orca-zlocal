import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import {
  AGENT_HUB_ORB_MAX_DIAMETER,
  AGENT_HUB_ORB_MIN_DIAMETER,
  fitAgentHubOrb,
  layoutAgentHubOrb,
  type AgentHubOrbSide
} from './agent-hub-orb-geometry'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { claimAgentHubOrbGesture, releaseAgentHubOrbGesture } from './agent-hub-orb-gesture'
import { useAgentHubOrbDiameter } from './use-agent-hub-orb-diameter'

type OrbGesture = {
  mode: 'move' | 'resize'
  pointerId: number
  element: HTMLElement
  pointer: { x: number; y: number }
  position: { x: number; y: number }
  preferredDiameter: number
  diameter: number
  width: number
  height: number
}

export function useAgentHubOrbGeometry({
  embedded,
  compact,
  live = false,
  requestVisible
}: {
  embedded: boolean
  compact: boolean
  live?: boolean
  requestVisible: boolean
}) {
  const { preferredDiameter, rememberDiameter } = useAgentHubOrbDiameter()
  const dockPlacement = useAppStore(
    (s) =>
      `${s.settings?.agentHubDockPosition?.edge}:${s.settings?.agentHubDockPosition?.offset}:${s.settings?.agentHubDockSize}`
  )
  const savedPosition = useAgentHubOrbPanel((s) => s.stagePosition)
  const shellRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<OrbGesture | null>(null)
  const previousSide = useRef<AgentHubOrbSide | undefined>(undefined)
  const [measurements, setMeasurements] = useState(() => ({
    bounds: readAgentHubOrbBounds(),
    controlsWidth: 170,
    requestHeight: 240,
    inlineWidth: 480,
    heightOverhead: 116
  }))
  const fit = {
    preferredDiameter,
    bounds: measurements.bounds,
    controlsWidth: measurements.controlsWidth,
    heightOverhead: measurements.heightOverhead,
    compact
  }
  const initialSize = fitAgentHubOrb({
    ...fit,
    position: { x: measurements.bounds.left, y: measurements.bounds.top }
  })
  const layout = layoutAgentHubOrb({
    ...fit,
    position: savedPosition ?? {
      x: (measurements.bounds.left + measurements.bounds.right - initialSize.width) / 2,
      y: (measurements.bounds.top + measurements.bounds.bottom - initialSize.height) / 2
    },
    ...(requestVisible && !embedded
      ? { requestSize: { width: 320, height: Math.min(480, measurements.requestHeight) } }
      : {}),
    previousSide: previousSide.current
  })
  const inlineMaximum = Math.max(
    32,
    Math.min(live ? 128 : 40, measurements.inlineWidth - measurements.controlsWidth - 48)
  )
  const geometry = embedded
    ? {
        ...layout.orb,
        diameter: Math.min(preferredDiameter, inlineMaximum),
        minimum: inlineMaximum,
        maximum: inlineMaximum
      }
    : layout.orb
  useLayoutEffect(() => {
    previousSide.current = layout.request?.side
  }, [layout.request?.side])

  useLayoutEffect(() => {
    let frame = 0
    const measure = (): void => {
      frame = 0
      const controlsWidth = controlsRef.current?.scrollWidth || 170
      const request = requestRef.current
      // Why: scrollHeight leaves out the borders, so a max-height from it alone always overflows.
      const requestHeight = request
        ? request.scrollHeight + request.offsetHeight - request.clientHeight
        : 240
      const inlineWidth =
        shellRef.current?.parentElement?.clientWidth || Math.min(480, window.innerWidth - 32)
      const currentDiameter = Number.parseFloat(
        shellRef.current?.style.getPropertyValue('--orb-diameter') ?? '0'
      )
      const heightOverhead = embedded
        ? 116
        : Math.max(116, (shellRef.current?.offsetHeight ?? 0) - currentDiameter)
      const bounds = readAgentHubOrbBounds()
      setMeasurements((previous) =>
        previous.controlsWidth === controlsWidth &&
        previous.requestHeight === requestHeight &&
        previous.inlineWidth === inlineWidth &&
        previous.heightOverhead === heightOverhead &&
        Object.entries(bounds).every(([key, value]) => Reflect.get(previous.bounds, key) === value)
          ? previous
          : { bounds, controlsWidth, requestHeight, inlineWidth, heightOverhead }
      )
    }
    const schedule = (): void => {
      if (!frame) {
        frame = requestAnimationFrame(measure)
      }
    }
    const observer = new ResizeObserver(schedule)
    for (const element of [
      shellRef.current,
      controlsRef.current,
      requestRef.current,
      document.querySelector('[data-agent-hub-dock]')
    ]) {
      if (element) {
        observer.observe(element)
      }
    }
    const mutations = new MutationObserver(schedule)
    if (requestRef.current) {
      mutations.observe(requestRef.current, { childList: true, subtree: true, characterData: true })
    }
    const dock = document.querySelector('[data-agent-hub-dock]')
    if (dock) {
      mutations.observe(dock, { attributes: true, attributeFilter: ['style', 'data-edge'] })
    }
    window.addEventListener('resize', schedule)
    measure()
    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [embedded, compact, requestVisible, dockPlacement])

  useEffect(() => {
    const finish = (cancel: boolean): void => {
      const active = gesture.current
      gesture.current = null
      releaseAgentHubOrbGesture(gesture)
      if (!active) {
        return
      }
      if (cancel) {
        useAgentHubOrbPanel.setState({
          stagePosition: active.position,
          ...(active.mode === 'resize' ? { preferredDiameter: active.preferredDiameter } : {})
        })
      } else if (active.mode === 'resize') {
        const diameter = useAgentHubOrbPanel.getState().preferredDiameter
        if (diameter !== active.preferredDiameter) {
          rememberDiameter(diameter)
        }
      }
      if (active.element.hasPointerCapture(active.pointerId)) {
        active.element.releasePointerCapture(active.pointerId)
      }
    }
    const move = (event: PointerEvent): void => {
      const active = gesture.current
      if (!active || event.pointerId !== active.pointerId) {
        return
      }
      const dx = event.clientX - active.pointer.x
      const dy = event.clientY - active.pointer.y
      if (active.mode === 'resize') {
        useAgentHubOrbPanel.setState({
          preferredDiameter: Math.max(
            AGENT_HUB_ORB_MIN_DIAMETER,
            Math.min(AGENT_HUB_ORB_MAX_DIAMETER, active.diameter + Math.max(dx, dy))
          )
        })
      } else {
        const bounds = readAgentHubOrbBounds()
        useAgentHubOrbPanel.setState({
          stagePosition: {
            x: Math.max(bounds.left, Math.min(bounds.right - active.width, active.position.x + dx)),
            y: Math.max(bounds.top, Math.min(bounds.bottom - active.height, active.position.y + dy))
          }
        })
      }
      event.preventDefault()
    }
    const end = (event: PointerEvent): void => {
      if (event.pointerId === gesture.current?.pointerId) {
        finish(event.type !== 'pointerup')
      }
    }
    const cancel = (): void => finish(true)
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
        cancel()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('lostpointercapture', end)
    window.addEventListener('blur', cancel)
    document.addEventListener('keydown', escape, true)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('lostpointercapture', end)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('keydown', escape, true)
      cancel()
    }
  }, [embedded, compact, rememberDiameter])

  return {
    geometry,
    request: layout.request,
    shellRef,
    controlsRef,
    requestRef,
    beginGesture: (mode: OrbGesture['mode'], event: React.PointerEvent<HTMLElement>): void => {
      if (
        event.button !== 0 ||
        gesture.current ||
        embedded ||
        (compact && mode === 'resize') ||
        !claimAgentHubOrbGesture(gesture, event.pointerId)
      ) {
        return
      }
      event.stopPropagation()
      event.preventDefault()
      gesture.current = {
        mode,
        pointerId: event.pointerId,
        element: event.currentTarget,
        pointer: { x: event.clientX, y: event.clientY },
        position: { x: geometry.x, y: geometry.y },
        preferredDiameter,
        diameter: geometry.diameter,
        width: geometry.width,
        height: geometry.height
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    resizeKey: (event: React.KeyboardEvent<HTMLElement>): void => {
      if (embedded || compact || gesture.current) {
        return
      }
      const step = event.shiftKey ? 24 : 8
      const next =
        event.key === 'Home'
          ? geometry.minimum
          : event.key === 'End'
            ? geometry.maximum
            : event.key === 'ArrowRight' || event.key === 'ArrowDown'
              ? geometry.diameter + step
              : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? geometry.diameter - step
                : null
      if (next === null) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const diameter = Math.max(AGENT_HUB_ORB_MIN_DIAMETER, Math.min(geometry.maximum, next))
      useAgentHubOrbPanel.setState({ preferredDiameter: diameter })
      rememberDiameter(diameter)
    }
  }
}
