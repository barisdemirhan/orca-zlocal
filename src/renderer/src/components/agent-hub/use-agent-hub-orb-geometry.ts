import { useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import {
  fitAgentHubOrb,
  layoutAgentHubOrb,
  placeAgentHubOrbRequest,
  type AgentHubOrbSide
} from './agent-hub-orb-geometry'
import { readAgentHubOrbBounds } from './agent-hub-orb-viewport'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import {
  NO_AGENT_HUB_ORB_OVERHANG,
  agentHubOrbPillBelow,
  liftAgentHubOrbAboveBottom,
  measureAgentHubOrbOverhang
} from './agent-hub-orb-overhang'
import { useAgentHubOrbDiameter } from './use-agent-hub-orb-diameter'
import { useAgentHubOrbDrag } from './use-agent-hub-orb-drag'
import {
  agentHubOrbPinnedQuickFits,
  layoutAgentHubOrbPinned,
  readAgentHubOrbDockBox,
  useAgentHubOrbPinned
} from './agent-hub-orb-dock-pin'

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
  const quickOpen = useAgentHubOrbPanel((s) => s.quickInputOpen)
  const pinned = useAgentHubOrbPinned()
  const shellRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const quickRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<HTMLDivElement>(null)
  const previousSide = useRef<AgentHubOrbSide | undefined>(undefined)
  const [measurements, setMeasurements] = useState(() => ({
    bounds: readAgentHubOrbBounds(),
    controlsWidth: 170,
    requestHeight: 240,
    inlineWidth: 480,
    heightOverhead: 116,
    overhang: NO_AGENT_HUB_ORB_OVERHANG,
    dock: readAgentHubOrbDockBox()
  }))
  const fit = {
    preferredDiameter,
    bounds: measurements.bounds,
    controlsWidth: measurements.controlsWidth,
    heightOverhead: measurements.heightOverhead,
    overhang: embedded ? NO_AGENT_HUB_ORB_OVERHANG : measurements.overhang,
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
  // Why: without a dock on screen a pinned sphere floats, so the pin survives the dock being hidden.
  const pinnedLayout =
    pinned && !embedded && measurements.dock
      ? layoutAgentHubOrbPinned(
          measurements.dock,
          measurements.controlsWidth,
          measurements.heightOverhead,
          window.innerHeight
        )
      : null
  const quickBeside =
    pinnedLayout !== null &&
    agentHubOrbPinnedQuickFits(pinnedLayout, measurements.controlsWidth, measurements.bounds)
  const geometry = embedded
    ? {
        ...layout.orb,
        diameter: Math.min(preferredDiameter, inlineMaximum),
        minimum: inlineMaximum,
        maximum: inlineMaximum
      }
    : (pinnedLayout ?? layout.orb)
  const request =
    pinnedLayout && layout.request
      ? (placeAgentHubOrbRequest({
          anchor: pinnedLayout,
          bounds: measurements.bounds,
          desiredSize: layout.request,
          previousSide: previousSide.current
        }) ?? layout.request)
      : layout.request
  useLayoutEffect(() => {
    previousSide.current = request?.side
  }, [request?.side])

  useLayoutEffect(() => {
    let frame = 0
    const measure = (): void => {
      frame = 0
      // Why: the hidden writing box keeps its width, so the sphere does not move when it opens.
      const controlsWidth =
        Math.max(controlsRef.current?.scrollWidth ?? 0, quickRef.current?.scrollWidth ?? 0) || 170
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
      const overhang = measureAgentHubOrbOverhang(
        shellRef.current,
        quickRef.current,
        currentDiameter + heightOverhead,
        quickOpen
      )
      if (!embedded && !useAgentHubOrbPanel.getState().pinned) {
        liftAgentHubOrbAboveBottom(bounds, overhang, currentDiameter + heightOverhead)
      }
      const dock = readAgentHubOrbDockBox()
      const next = {
        bounds,
        controlsWidth,
        requestHeight,
        inlineWidth,
        heightOverhead,
        overhang,
        dock
      }
      // Why: every field is a plain number in a fixed key order, so equal text means nothing moved.
      setMeasurements((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next
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
      quickRef.current,
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
  }, [embedded, compact, requestVisible, dockPlacement, quickOpen, pinned])
  const drag = useAgentHubOrbDrag({
    embedded,
    compact,
    pinned: pinnedLayout !== null,
    geometry,
    overhang: fit.overhang,
    preferredDiameter,
    rememberDiameter
  })

  return {
    geometry,
    pinned: pinnedLayout,
    quickBeside,
    pillBelow:
      !embedded &&
      (pinnedLayout
        ? measurements.dock?.edge === 'top'
        : agentHubOrbPillBelow(geometry.y, measurements.overhang, measurements.bounds)),
    request,
    shellRef,
    controlsRef,
    quickRef,
    requestRef,
    ...drag
  }
}
