import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { AgentHubOrbFrame } from './AgentHubOrbSphere'
import {
  SLEEP_MS,
  WAKE_CALM_MS,
  WAKE_MS,
  agentHubOrbMotionProfile,
  type AgentHubOrbMotionProfile,
  orbFloatOffset,
  orbFollowShare,
  orbHopLift,
  orbSleepFrame,
  orbStretch,
  orbThrowPoint,
  orbWakeFrame,
  planOrbThrow,
  type OrbFlightFrame,
  type OrbPoint
} from './agent-hub-orb-motion'
import {
  finishAgentHubOrbFlight,
  pulseAgentHubOrbSlot,
  readAgentHubOrbMotion,
  useAgentHubOrbFlight,
  type AgentHubOrbFlight
} from './agent-hub-orb-flight-store'

export type AgentHubOrbMotionHandle = {
  setDragging: (dragging: boolean) => void
  /** Plans the throw from the sphere's current spot; null when this motion mode does not throw. */
  throwFrom: (args: {
    velocity: OrbPoint
    clamp: (point: OrbPoint) => OrbPoint
    dock: OrbPoint | null
  }) => { rest: OrbPoint; docked: boolean } | null
}

type MotionInput = {
  enabled: boolean
  ghost: boolean
  layout: OrbPoint
  engaged: boolean
  pinned: boolean
  shadow: HTMLElement | null
}

type MotionState = {
  pos: OrbPoint | null
  scale: number
  stretch: number
  angle: number
  amplitude: number
  hopAt: number
  flight: AgentHubOrbFlight | null
  /** Where the sphere was when the flight began, so a failed wake turns back from mid-air. */
  flightStart: OrbFlightFrame | null
  path: OrbPoint[] | null
  pathStart: number | null
  dragging: boolean
}

const FOLLOW_RATE = 8
const DRAG_RATE = 22
const SHADOW_DROP = 0.46

function clearTransforms(root: HTMLElement, shadow: HTMLElement | null): void {
  root.style.transform = ''
  root.style.visibility = ''
  if (shadow) {
    shadow.style.transform = ''
    shadow.style.opacity = ''
  }
}

function flightFrame(
  flight: AgentHubOrbFlight,
  now: number,
  layout: OrbPoint,
  profile: AgentHubOrbMotionProfile,
  start: OrbFlightFrame
): { frame: OrbFlightFrame; k: number } {
  const wake = flight.kind === 'wake'
  const duration = wake ? (profile.flies ? WAKE_MS : WAKE_CALM_MS) : SLEEP_MS
  const k = (now - flight.startedAt) / duration
  const slot = flight.slot ?? layout
  return {
    k,
    frame: wake
      ? orbWakeFrame(slot, layout, Math.max(0, k), profile)
      : orbSleepFrame(start.pos, slot, Math.max(0, k), profile, start.scale)
  }
}

function advance(s: MotionState, input: MotionInput, frame: AgentHubOrbFrame): void {
  const { root, now, pulse } = frame
  const { layout, shadow } = input
  const profile = agentHubOrbMotionProfile(readAgentHubOrbMotion())
  if (!input.enabled) {
    clearTransforms(root, shadow)
    return
  }
  const dt = Math.min(frame.dt, 0.05)
  const seconds = now / 1000
  const flight = useAgentHubOrbFlight.getState().flight
  if (flight !== s.flight) {
    s.flight = flight
    s.flightStart = { pos: s.pos ?? layout, scale: s.scale }
  }
  let flying: OrbFlightFrame | null = null
  if (flight && flight.kind === 'return' && !input.ghost) {
    // Why: a sleep flight belongs to the stand-in sphere; a live stage never plays it.
    finishAgentHubOrbFlight(flight)
    s.flight = null
  } else if (flight) {
    const { frame: step, k } = flightFrame(
      flight,
      now,
      layout,
      profile,
      s.flightStart ?? { pos: layout, scale: 1 }
    )
    if (k < 1) {
      flying = step
    } else {
      finishAgentHubOrbFlight(flight)
      s.flight = null
      if (flight.kind === 'return') {
        pulseAgentHubOrbSlot()
        root.style.visibility = 'hidden'
        return
      }
      if (k < 2) {
        pulse()
      }
      s.amplitude = 0
      s.pos = layout
      s.scale = 1
    }
  }
  const previous = s.pos ?? layout
  let pos = previous
  let still = false
  if (flying) {
    pos = flying.pos
    s.scale = flying.scale
    s.path = null
  } else if (profile.still) {
    pos = layout
    s.scale = 1
    s.stretch = 0
    still = true
  } else if (s.path) {
    s.pathStart ??= now
    const point = orbThrowPoint(s.path, (now - s.pathStart) / 1000)
    if (point) {
      pos = point
    } else {
      s.path = null
      s.pathStart = null
      s.amplitude = 0
      pos = layout
    }
    s.scale += (1 - s.scale) * Math.min(1, dt * 9)
  } else {
    const share = orbFollowShare(dt, s.dragging ? DRAG_RATE : FOLLOW_RATE)
    pos = {
      x: previous.x + (layout.x - previous.x) * share,
      y: previous.y + (layout.y - previous.y) * share
    }
    s.scale += ((s.dragging ? 1.04 : 1) - s.scale) * Math.min(1, dt * 9)
  }
  s.pos = pos

  let fx = 0
  let fy = 0
  if (!flying && !s.path && !still) {
    const want = s.dragging ? 0 : input.engaged || input.pinned ? 0.25 : 1
    s.amplitude += (want - s.amplitude) * Math.min(1, dt * 1.6)
    const float = orbFloatOffset(seconds, s.amplitude * profile.float)
    fx = float.x
    fy = float.y - (profile.hops ? orbHopLift(seconds - s.hopAt) : 0)
  }

  const vx = dt > 0 ? (pos.x - previous.x) / dt : 0
  const vy = dt > 0 ? (pos.y - previous.y) / dt : 0
  const speed = Math.hypot(vx, vy)
  if (speed > 20) {
    s.angle = Math.atan2(vy, vx)
  }
  s.stretch += (orbStretch(speed, profile) - s.stretch) * Math.min(1, dt * 16)

  const ox = pos.x + fx - layout.x
  const oy = pos.y + fy - layout.y
  const identity = ox === 0 && oy === 0 && s.scale === 1 && s.stretch < 0.001
  root.style.visibility = ''
  root.style.transform = identity
    ? ''
    : `translate(${ox}px, ${oy}px) rotate(${s.angle}rad) scale(${s.scale * (1 + s.stretch)}, ${s.scale * (1 - s.stretch * 0.7)}) rotate(${-s.angle}rad)`
  if (shadow) {
    const rise = Math.max(0, -fy) / 20
    shadow.style.transform = `translate(${pos.x + fx * 0.4 - layout.x}px, ${pos.y - layout.y}px) scale(${s.scale * (1 - rise * 0.4)}) translateY(${root.clientWidth * SHADOW_DROP}px)`
    shadow.style.opacity = String((0.8 - rise * 0.5) * Math.min(1, s.scale))
  }
}

/**
 * Drives the floating sphere's float, wake, sleep, drag follow and throw as one transform written
 * from the canvas loop; layout, hit-testing and the stored position never see it.
 */
export function useAgentHubOrbMotion({
  enabled,
  ghost,
  centre,
  engaged,
  pinned,
  needsYou,
  handleRef,
  artRef,
  shadowRef
}: {
  enabled: boolean
  ghost: boolean
  /** The sphere's resting centre in viewport coordinates. */
  centre: OrbPoint
  /** Hover, the writing box, a card or a caption is open: the sphere floats less. */
  engaged: boolean
  pinned: boolean
  needsYou: boolean
  handleRef: RefObject<AgentHubOrbMotionHandle | null>
  artRef: RefObject<HTMLElement | null>
  shadowRef: RefObject<HTMLElement | null>
}): (frame: AgentHubOrbFrame) => void {
  const state = useRef<MotionState>({
    pos: null,
    scale: 1,
    stretch: 0,
    angle: 0,
    amplitude: 1,
    hopAt: Number.NEGATIVE_INFINITY,
    flight: null,
    flightStart: null,
    path: null,
    pathStart: null,
    dragging: false
  })
  const input = useRef<MotionInput>({
    enabled,
    ghost,
    layout: centre,
    engaged,
    pinned,
    shadow: null
  })
  useLayoutEffect(() => {
    input.current = {
      enabled,
      ghost,
      layout: centre,
      engaged,
      pinned,
      shadow: shadowRef.current
    }
  })
  useLayoutEffect(() => {
    // Why: the first frame of a flight is placed before paint, so the sphere never shows at rest first.
    const root = artRef.current?.querySelector<HTMLElement>('.agent-hub-orb-sphere')
    if (root && useAgentHubOrbFlight.getState().flight) {
      advance(state.current, input.current, {
        dt: 0,
        now: performance.now(),
        root,
        pulse: () => {}
      })
    }
  }, [artRef])
  const wasNeedingYou = useRef(needsYou)
  useEffect(() => {
    if (needsYou && !wasNeedingYou.current) {
      state.current.hopAt = performance.now() / 1000
    }
    wasNeedingYou.current = needsYou
  }, [needsYou])
  useEffect(() => {
    handleRef.current = {
      setDragging: (dragging) => {
        state.current.dragging = dragging
        if (dragging) {
          state.current.path = null
        }
      },
      throwFrom: ({ velocity, clamp, dock }) => {
        if (!agentHubOrbMotionProfile(readAgentHubOrbMotion()).throws) {
          return null
        }
        const plan = planOrbThrow({
          from: state.current.pos ?? input.current.layout,
          velocity,
          clamp,
          dock
        })
        state.current.path = plan.path
        state.current.pathStart = null
        return { rest: plan.rest, docked: plan.docked }
      }
    }
    return () => {
      handleRef.current = null
    }
  }, [handleRef])
  return useCallback((frame: AgentHubOrbFrame) => advance(state.current, input.current, frame), [])
}
