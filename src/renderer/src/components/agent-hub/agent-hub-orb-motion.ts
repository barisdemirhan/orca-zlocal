import type { AgentHubOrbMotion } from '../../../../shared/agent-hub-orb-motion-setting'

export type OrbPoint = { x: number; y: number }
export type OrbTrailSample = OrbPoint & { t: number }

export const WAKE_MS = 640
export const WAKE_CALM_MS = 350
export const SLEEP_MS = 420
export const WAKE_START_SCALE = 0.27
const SLEEP_END_SCALE = 0.27
const ARC_RISE = 90
const RETURN_RISE = 40
const MAX_STRETCH = 0.2
const STRETCH_SPEED = 5200
const FLOAT_Y = 6
const FLOAT_X = 3
const FLOAT_Y_SECONDS = 6.4
const FLOAT_X_SECONDS = 9.1
const HOP_SECONDS = 0.9
const THROW_FRICTION = 3.2
const THROW_BOUNCE = 0.55
const THROW_REST_SPEED = 14
const THROW_MIN_SPEED = 220
const THROW_MAX_SPEED = 2200
const THROW_STEP = 1 / 120
const THROW_MAX_STEPS = 600
const RELEASE_WINDOW_MS = 100
const RELEASE_STALE_MS = 80
const DOCK_MAGNET = 70
const DOCK_GLIDE_STEPS = 14

export type AgentHubOrbMotionProfile = {
  /** Wake and sleep fly between the launcher and the stage; otherwise they grow or shrink in place. */
  flies: boolean
  /** Wake and sleep animate at all. */
  transitions: boolean
  /** Colour and breath only: no flight, float, follow or stretch. */
  still: boolean
  float: number
  hops: boolean
  throws: boolean
  stretches: boolean
}

export function agentHubOrbMotionProfile(mode: AgentHubOrbMotion): AgentHubOrbMotionProfile {
  switch (mode) {
    case 'calm':
      return {
        flies: false,
        transitions: true,
        still: false,
        float: 0.5,
        hops: false,
        throws: false,
        stretches: false
      }
    case 'off':
      return {
        flies: false,
        transitions: false,
        still: true,
        float: 0,
        hops: false,
        throws: false,
        stretches: false
      }
    default:
      return {
        flies: true,
        transitions: true,
        still: false,
        float: 1,
        hops: true,
        throws: true,
        stretches: true
      }
  }
}

/** Ease-out with a small overshoot, so the sphere lands a touch past its spot and settles back. */
export function orbWakeEase(k: number): number {
  const overshoot = 1.3
  const t = Math.min(1, Math.max(0, k)) - 1
  return 1 + (overshoot + 1) * t ** 3 + overshoot * t ** 2
}

export function orbSmoothstep(k: number): number {
  const t = Math.min(1, Math.max(0, k))
  return t * t * (3 - 2 * t)
}

/** A quadratic arc that rises above both ends; `e` may pass 1 for the overshoot. */
export function orbArcPoint(from: OrbPoint, to: OrbPoint, e: number, rise: number): OrbPoint {
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - rise }
  const q = 1 - e
  return {
    x: q * q * from.x + 2 * q * e * control.x + e * e * to.x,
    y: q * q * from.y + 2 * q * e * control.y + e * e * to.y
  }
}

export type OrbFlightFrame = { pos: OrbPoint; scale: number }

export function orbWakeFrame(
  from: OrbPoint,
  to: OrbPoint,
  k: number,
  profile: AgentHubOrbMotionProfile
): OrbFlightFrame {
  const e = orbWakeEase(k)
  if (!profile.flies) {
    return { pos: to, scale: 0.3 + 0.7 * e }
  }
  return {
    pos: orbArcPoint(from, to, e, ARC_RISE),
    scale: WAKE_START_SCALE + (1 - WAKE_START_SCALE) * e
  }
}

export function orbSleepFrame(
  from: OrbPoint,
  slot: OrbPoint,
  k: number,
  profile: AgentHubOrbMotionProfile,
  startScale = 1
): OrbFlightFrame {
  const z = orbSmoothstep(k)
  const scale = startScale + (SLEEP_END_SCALE - startScale) * z
  if (!profile.flies) {
    return { pos: from, scale }
  }
  return {
    pos: {
      x: from.x + (slot.x - from.x) * z,
      y: from.y + (slot.y - from.y) * z - RETURN_RISE * Math.sin(Math.PI * z)
    },
    scale
  }
}

export function orbFloatOffset(seconds: number, amplitude: number): OrbPoint {
  return {
    x: Math.sin((seconds * Math.PI * 2) / FLOAT_X_SECONDS + 1) * FLOAT_X * amplitude,
    y: Math.sin((seconds * Math.PI * 2) / FLOAT_Y_SECONDS) * FLOAT_Y * amplitude
  }
}

/** The upward lift of the two attention hops, a bigger one then a smaller one. */
export function orbHopLift(sinceHop: number): number {
  if (sinceHop < 0 || sinceHop >= HOP_SECONDS) {
    return 0
  }
  const first = sinceHop < HOP_SECONDS / 2
  return Math.abs(Math.sin((sinceHop / (HOP_SECONDS / 2)) * Math.PI)) * (first ? 16 : 8)
}

export function orbStretch(speed: number, profile: AgentHubOrbMotionProfile): number {
  return profile.stretches ? Math.min(MAX_STRETCH, speed / STRETCH_SPEED) : 0
}

/** Frame-rate independent share of the remaining distance to cover this frame. */
export function orbFollowShare(dt: number, rate: number): number {
  return 1 - Math.exp(-dt * rate)
}

/** Pointer speed over the last moments before release, or null when the pointer had stopped. */
export function orbReleaseVelocity(trail: readonly OrbTrailSample[], now: number): OrbPoint | null {
  const last = trail.at(-1)
  if (!last || now - last.t > RELEASE_STALE_MS) {
    return null
  }
  const first = trail.find((sample) => last.t - sample.t <= RELEASE_WINDOW_MS) ?? last
  const span = Math.max(0.016, (last.t - first.t) / 1000)
  const scale = Math.min(
    1,
    THROW_MAX_SPEED / Math.max(1, Math.hypot(last.x - first.x, last.y - first.y) / span)
  )
  const velocity = {
    x: ((last.x - first.x) / span) * scale,
    y: ((last.y - first.y) / span) * scale
  }
  return Math.hypot(velocity.x, velocity.y) >= THROW_MIN_SPEED ? velocity : null
}

export type OrbThrowPlan = {
  /** One point per THROW_STEP seconds, ending at `rest`. */
  path: OrbPoint[]
  rest: OrbPoint
  docked: boolean
}

/** Pre-computes the whole throw, so the resting spot is known (and stored) at release. */
export function planOrbThrow({
  from,
  velocity,
  clamp,
  dock
}: {
  from: OrbPoint
  velocity: OrbPoint
  clamp: (point: OrbPoint) => OrbPoint
  dock: OrbPoint | null
}): OrbThrowPlan {
  let pos = clamp(from)
  let vx = velocity.x
  let vy = velocity.y
  const path: OrbPoint[] = [pos]
  const friction = Math.exp(-THROW_STEP * THROW_FRICTION)
  for (let step = 0; step < THROW_MAX_STEPS; step++) {
    const raw = { x: pos.x + vx * THROW_STEP, y: pos.y + vy * THROW_STEP }
    vx *= friction
    vy *= friction
    pos = clamp(raw)
    if (pos.x > raw.x) {
      vx = Math.abs(vx) * THROW_BOUNCE
    } else if (pos.x < raw.x) {
      vx = -Math.abs(vx) * THROW_BOUNCE
    }
    if (pos.y > raw.y) {
      vy = Math.abs(vy) * THROW_BOUNCE
    } else if (pos.y < raw.y) {
      vy = -Math.abs(vy) * THROW_BOUNCE
    }
    path.push(pos)
    if (dock && Math.hypot(pos.x - dock.x, pos.y - dock.y) < DOCK_MAGNET) {
      const start = pos
      for (let glide = 1; glide <= DOCK_GLIDE_STEPS; glide++) {
        const z = orbSmoothstep(glide / DOCK_GLIDE_STEPS)
        path.push({ x: start.x + (dock.x - start.x) * z, y: start.y + (dock.y - start.y) * z })
      }
      return { path, rest: dock, docked: true }
    }
    if (Math.hypot(vx, vy) < THROW_REST_SPEED) {
      break
    }
  }
  return { path, rest: pos, docked: false }
}

export function orbThrowPoint(path: readonly OrbPoint[], seconds: number): OrbPoint | null {
  const index = seconds / THROW_STEP
  const last = path.at(-1)
  if (!last || index >= path.length - 1) {
    return null
  }
  const base = Math.floor(index)
  const share = index - base
  const a = path[base]
  const b = path[base + 1]
  return { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share }
}
