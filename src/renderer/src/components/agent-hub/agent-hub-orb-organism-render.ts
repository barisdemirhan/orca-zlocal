import { mixOrbRgb, type OrbRgb, type OrbStateParams } from './agent-hub-orb-palette'
import type { AgentHubOrbStateKey } from './agent-hub-orb-phase'

export type AgentHubOrbDetail = 'tiny' | 'mid' | 'full'

export const TAU = Math.PI * 2
export const PARTICLE_COUNT = 64
export const RING_LIFE = 1.6
export const SPARK_LIFE = 1.3
const WHITE: OrbRgb = [255, 255, 255]
const SHADOW: OrbRgb = [11, 12, 16]

export type OrbRing = { born: number; strength: number; color: OrbRgb }
export type OrbSpark = { a: number; born: number; v: number }
export type OrbParticle = { rho: number; ang: number; i: number; jit: number }

export type OrganismView = {
  readonly cur: OrbStateParams
  readonly t: number
  readonly enteredAt: number
  readonly level: number
  readonly stateKey: AgentHubOrbStateKey
  readonly rings: readonly OrbRing[]
  readonly sparks: readonly OrbSpark[]
  readonly ph: {
    b: number
    l2: number
    l3: number
    l5: number
    l11: number
    nuc: number
    ring: number
    beat: number
  }
  readonly particles: readonly OrbParticle[]
}

export function agentHubOrbDetail(size: number): AgentHubOrbDetail {
  if (size < 40) {
    return 'tiny'
  }
  return size < 100 ? 'mid' : 'full'
}

export const angDiff = (a: number, b: number): number =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b))
const rgba = (c: OrbRgb, a: number): string =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a))})`

function beatEnv(v: OrganismView): number {
  const x = v.ph.beat
  const pulse = (c: number, w: number): number => Math.exp(-(((x - c) / w) ** 2))
  return (
    v.cur.beat1 * pulse(0.04, 0.07) + v.cur.beat2 * (pulse(0.04, 0.055) + 0.7 * pulse(0.24, 0.055))
  )
}

function membrane(v: OrganismView, R: number, detail: AgentHubOrbDetail): [number, number][] {
  const { cur, ph, level, t, enteredAt, stateKey } = v
  const age = t - enteredAt
  const voice = cur.audioOut * level * 1.7 + cur.audioIn * level * 0.9
  const breath = cur.breathAmp * Math.sin(ph.b)
  let bloom = 0
  let shiver = 0
  if (stateKey === 'success') {
    bloom = 0.13 * Math.exp(-(((age - 0.32) / 0.2) ** 2))
  }
  if (stateKey === 'error') {
    shiver = 0.045 * Math.exp(-age / 0.8) + 0.004
  }
  if (stateKey === 'stopping') {
    bloom = -0.05 * Math.min(age / 1.2, 1)
  }
  const scale =
    cur.scale *
    (1 +
      breath +
      beatEnv(v) * 0.07 +
      cur.audioOut * level * 0.085 +
      cur.audioIn * level * 0.03 +
      bloom)
  const amp = 1 + voice
  const n = detail === 'tiny' ? 40 : 96
  const reach = cur.reach + cur.audioIn * level * 0.07 + beatEnv(v) * cur.reach * 0.5
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU
    let r =
      1 +
      amp * cur.a2 * Math.sin(2 * th + ph.l2) +
      amp * cur.a3 * Math.sin(3 * th + ph.l3) +
      amp * cur.a3 * 0.5 * Math.sin(4 * th - ph.l2 * 1.3) +
      amp * cur.a5 * Math.sin(5 * th + ph.l5) +
      (cur.jitter + shiver) * 0.5 * (Math.sin(11 * th + ph.l11) + Math.sin(13 * th - ph.l11 * 1.3))
    const d = angDiff(th, cur.reachDir)
    r += reach * Math.exp(-(d * d) / (2 * 0.36 * 0.36))
    const rr = R * scale * r
    pts.push([Math.cos(th) * rr, Math.sin(th) * rr * cur.squashY])
  }
  return pts
}

function tracePath(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  cx: number,
  cy: number,
  k = 1
): void {
  const n = pts.length
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    if (i === 0) {
      ctx.moveTo(cx + p1[0] * k, cy + p1[1] * k)
    }
    ctx.bezierCurveTo(
      cx + (p1[0] + (p2[0] - p0[0]) / 6) * k,
      cy + (p1[1] + (p2[1] - p0[1]) / 6) * k,
      cx + (p2[0] - (p3[0] - p1[0]) / 6) * k,
      cy + (p2[1] - (p3[1] - p1[1]) / 6) * k,
      cx + p2[0] * k,
      cy + p2[1] * k
    )
  }
  ctx.closePath()
}

export function drawOrganism(
  ctx: CanvasRenderingContext2D,
  size: number,
  detail: AgentHubOrbDetail,
  v: OrganismView
): void {
  const { ph, level, t, stateKey, particles, rings, sparks } = v
  ctx.clearRect(0, 0, size, size)
  const P = v.cur
  const cx = size / 2
  const cy = size / 2
  const half = size / 2
  // Leave headroom so the aura and ripples fade out inside the canvas.
  const R = size * (detail === 'tiny' ? 0.42 : 0.32)
  const pts = membrane(v, R, detail)
  const dimK = 1 - P.dim

  if (detail !== 'tiny') {
    const g = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, half)
    g.addColorStop(0, rgba(P.rim, P.glow * 0.55 * dimK))
    g.addColorStop(1, rgba(P.rim, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  if (P.orbitRing > 0.02 && detail !== 'tiny') {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(ph.ring)
    ctx.strokeStyle = rgba(P.rim, 0.45 * P.orbitRing)
    ctx.lineWidth = Math.max(1, size / 220)
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.32, 0, TAU * 0.28)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.32, Math.PI, Math.PI + TAU * 0.12)
    ctx.stroke()
    ctx.restore()
  }
  const kMax = Math.max(1.05, (half * 0.98) / (R * Math.max(P.scale, 0.5) * 1.12))
  for (const r of rings) {
    const age = t - r.born
    if (age < 0) {
      continue
    }
    tracePath(ctx, pts, cx, cy, 1 + (kMax - 1) * (age / RING_LIFE))
    ctx.strokeStyle = rgba(r.color, 0.5 * r.strength * (1 - age / RING_LIFE) * dimK)
    ctx.lineWidth = Math.max(0.8, size / 160) * (1 - age / 2)
    ctx.stroke()
  }

  tracePath(ctx, pts, cx, cy)
  const hl = mixOrbRgb(P.core, WHITE, 0.42 * dimK)
  const body = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.05, cx, cy, R * 1.12)
  body.addColorStop(0, rgba(hl, 0.95))
  body.addColorStop(0.42, rgba(mixOrbRgb(P.core, SHADOW, P.dim * 0.6), 0.92))
  body.addColorStop(1, rgba(mixOrbRgb(P.core, SHADOW, 0.72), 0.95))
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  tracePath(ctx, pts, cx, cy)
  ctx.clip()
  if (detail === 'full') {
    const dot = Math.max(0.6, size / 260)
    const dotColor = mixOrbRgb(P.rim, WHITE, 0.3)
    for (const p of particles) {
      const vis = Math.min(1, Math.max(0, (P.pCount * PARTICLE_COUNT - p.i) / 6))
      if (vis <= 0) {
        continue
      }
      const rr = p.rho * R * P.scale
      ctx.fillStyle = rgba(dotColor, 0.55 * vis * dimK * (0.6 + 0.4 * Math.sin(t * 2 + p.jit)))
      ctx.beginPath()
      ctx.arc(
        cx + Math.cos(p.ang) * rr,
        cy + Math.sin(p.ang) * rr * P.squashY,
        dot * (1 + p.rho),
        0,
        TAU
      )
      ctx.fill()
    }
  }
  if (P.nucleus > 0.02) {
    const off = R * 0.2 * P.scale
    const nx = cx + Math.cos(ph.nuc) * off
    const ny = cy + Math.sin(ph.nuc * 0.8) * off * 0.7
    const dictLevel = stateKey === 'dictating' ? level * 0.5 : 0
    const nr = R * P.nucleus * 0.5 * (1 + dictLevel + beatEnv(v) * 0.25)
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr * 1.8)
    ng.addColorStop(0, rgba(P.nucleusTint, 0.85 * dimK))
    ng.addColorStop(0.45, rgba(P.nucleusTint, 0.35 * dimK))
    ng.addColorStop(1, rgba(P.nucleusTint, 0))
    ctx.fillStyle = ng
    ctx.beginPath()
    ctx.arc(nx, ny, nr * 1.8, 0, TAU)
    ctx.fill()
  }
  const shade = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.3, cx, cy, R * 1.1)
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(5,6,9,.45)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  tracePath(ctx, pts, cx, cy)
  ctx.strokeStyle = rgba(mixOrbRgb(P.rim, WHITE, 0.2), (0.35 + P.glow * 0.6) * dimK)
  ctx.lineWidth = Math.max(0.7, size / 200) * (1 + P.beat2 * 0.8)
  ctx.stroke()
  if (detail !== 'tiny') {
    const gx = cx - R * 0.34
    const gy = cy - R * 0.42
    const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.38)
    gl.addColorStop(0, `rgba(255,255,255,${0.28 * dimK})`)
    gl.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.arc(gx, gy, R * 0.38, 0, TAU)
    ctx.fill()
  }
  for (const s of sparks) {
    const age = t - s.born
    const d = Math.min(R * (1 + age * s.v * 1.1), half * 0.97)
    ctx.fillStyle = rgba(P.rim, 1 - age / SPARK_LIFE)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d, Math.max(0.8, size / 180), 0, TAU)
    ctx.fill()
  }
}
