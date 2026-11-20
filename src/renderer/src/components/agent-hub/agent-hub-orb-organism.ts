import type { AgentHubOrbStateKey } from './agent-hub-orb-phase'
import {
  PARTICLE_COUNT,
  RING_LIFE,
  SPARK_LIFE,
  TAU,
  angDiff,
  agentHubOrbDetail,
  drawOrganism,
  type AgentHubOrbDetail,
  type OrbParticle,
  type OrbRing,
  type OrbSpark,
  type OrganismView
} from './agent-hub-orb-organism-render'
import {
  FALLBACK_ORB_PALETTE,
  type AgentHubOrbPalette,
  type OrbRgb,
  type OrbStateParams
} from './agent-hub-orb-palette'
import { buildOrbStateParams } from './agent-hub-orb-state-params'

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function noise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return hash(i) * (1 - u) + hash(i + 1) * u
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k

function mixInto(target: OrbRgb, to: OrbRgb, k: number): void {
  target[0] = lerp(target[0], to[0], k)
  target[1] = lerp(target[1], to[1], k)
  target[2] = lerp(target[2], to[2], k)
}

type SmoothedKey = Exclude<
  {
    [K in keyof OrbStateParams]: OrbStateParams[K] extends number ? K : never
  }[keyof OrbStateParams],
  'reachDir'
>

const SMOOTHED_KEYS: SmoothedKey[] = [
  'scale',
  'breathHz',
  'breathAmp',
  'a2',
  'a3',
  'a5',
  'lobeSpeed',
  'jitter',
  'glow',
  'nucleus',
  'pCount',
  'pSpeed',
  'swirl',
  'radial',
  'reach',
  'beat1',
  'beat2',
  'beatPeriod',
  'rippleEvery',
  'squashY',
  'audioIn',
  'audioOut',
  'orbitRing',
  'dim'
]

function cloneParams(p: OrbStateParams): OrbStateParams {
  return { ...p, core: [...p.core], rim: [...p.rim], nucleusTint: [...p.nucleusTint] }
}

export { agentHubOrbDetail, type AgentHubOrbDetail }

export type AgentHubOrganism = {
  setState: (key: AgentHubOrbStateKey) => void
  setPalette: (palette: AgentHubOrbPalette) => void
  setInputActive: (active: boolean) => void
  step: (dt: number) => void
  draw: (ctx: CanvasRenderingContext2D, size: number, detail: AgentHubOrbDetail) => void
}

export function createAgentHubOrganism(
  initialState: AgentHubOrbStateKey = 'idle',
  initialPalette: AgentHubOrbPalette = FALLBACK_ORB_PALETTE
): AgentHubOrganism {
  let states = buildOrbStateParams(initialPalette)
  let stateKey = initialState
  let target = states[stateKey]
  const cur = cloneParams(target)
  let t = 0
  let enteredAt = 0
  let level = 0
  let drive = 0
  let inputActive = false
  let lastPeak = 0
  let rippleClock = 0
  let rings: OrbRing[] = []
  let sparks: OrbSpark[] = []
  const ph = { b: 0, l2: 0.6, l3: 1.7, l5: 2.9, l11: 0, nuc: 0.8, ring: 0.5, beat: 0.5 }
  const particles: OrbParticle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    rho: Math.random() * 0.9,
    ang: Math.random() * TAU,
    i,
    jit: Math.random() * TAU
  }))

  const emitRing = (strength: number, color: OrbRgb, delay = 0): void => {
    rings.push({ born: t + delay, strength, color: [...color] })
  }

  function setState(key: AgentHubOrbStateKey): void {
    if (stateKey === key) {
      return
    }
    stateKey = key
    target = states[key]
    enteredAt = t
    if (key === 'success') {
      emitRing(1.2, target.rim)
      emitRing(0.7, target.core, 0.25)
      for (let i = 0; i < 16; i++) {
        sparks.push({
          a: (i / 16) * TAU + Math.random() * 0.3,
          born: t,
          v: 0.7 + Math.random() * 0.6
        })
      }
    }
    if (key === 'attention') {
      rippleClock = 3.4
    }
  }

  function setPalette(palette: AgentHubOrbPalette): void {
    states = buildOrbStateParams(palette)
    target = states[stateKey]
  }

  function step(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05)
    const kShape = 1 - Math.exp(-dt / 0.45)
    const kColor = 1 - Math.exp(-dt / 0.8)
    for (const key of SMOOTHED_KEYS) {
      cur[key] = lerp(cur[key], target[key], kShape)
    }
    cur.reachDir += angDiff(target.reachDir, cur.reachDir) * kShape
    mixInto(cur.core, target.core, kColor)
    mixInto(cur.rim, target.rim, kColor)
    mixInto(cur.nucleusTint, target.nucleusTint, kColor)
    t += dt
    ph.b += TAU * cur.breathHz * dt
    ph.l2 += cur.lobeSpeed * 0.7 * dt
    ph.l3 -= cur.lobeSpeed * 0.9 * dt
    ph.l5 += cur.lobeSpeed * 1.3 * dt
    ph.l11 += 9 * dt
    ph.nuc += (0.3 + cur.swirl * 1.6) * dt
    ph.ring += 1.2 * dt

    // Syllable-gated noise reads like speech; it only runs while a voice drives it.
    let driveTarget = inputActive ? 1 : 0
    if (stateKey === 'speaking') {
      driveTarget = 1
    } else if (stateKey === 'dictating') {
      driveTarget = inputActive ? 1 : 0.4
    }
    drive = lerp(drive, driveTarget, 1 - Math.exp(-dt / (driveTarget > drive ? 0.08 : 0.3)))
    const syll = noise(t * 2.2) > 0.35 ? 1 : 0.15
    const raw = (noise(t * 9) * 0.7 + noise(t * 23 + 5) * 0.3) * syll * drive
    level = lerp(level, raw, 1 - Math.exp(-dt / 0.06))
    const audioAmt = Math.max(cur.audioIn, cur.audioOut)
    if (audioAmt > 0.5 && level > 0.62 && t - lastPeak > 0.38) {
      lastPeak = t
      emitRing(0.55 * audioAmt, cur.rim)
    }

    const prevBeat = ph.beat
    ph.beat = (ph.beat + dt / cur.beatPeriod) % 1
    if (ph.beat < prevBeat && (cur.beat1 > 0.5 || cur.beat2 > 0.5)) {
      emitRing(0.9, cur.rim)
    }
    if (cur.beat2 > 0.5 && prevBeat < 0.2 && ph.beat >= 0.2) {
      emitRing(0.5, cur.rim)
    }
    if (cur.rippleEvery > 0.5) {
      rippleClock += dt
      if (rippleClock >= cur.rippleEvery) {
        rippleClock = 0
        emitRing(0.7, cur.rim)
      }
    }
    if (rings.length > 0) {
      rings = rings.filter((r) => t - r.born < RING_LIFE)
    }
    if (sparks.length > 0) {
      sparks = sparks.filter((s) => t - s.born < SPARK_LIFE)
    }
    for (const p of particles) {
      p.ang += (cur.swirl * cur.pSpeed * 2.2 * (1.15 - p.rho) + 0.05) * dt
      p.rho += (cur.radial * cur.pSpeed * 0.35 + (noise(t * 0.7 + p.i) - 0.5) * 0.08) * dt
      if (p.rho > 0.92) {
        p.rho = 0.08
      }
      if (p.rho < 0.05) {
        p.rho = 0.9
      }
    }
  }

  const view: OrganismView = {
    cur,
    get t() {
      return t
    },
    get enteredAt() {
      return enteredAt
    },
    get level() {
      return level
    },
    get stateKey() {
      return stateKey
    },
    get rings() {
      return rings
    },
    get sparks() {
      return sparks
    },
    ph,
    particles
  }

  return {
    setState,
    setPalette,
    setInputActive: (active) => {
      inputActive = active
    },
    step,
    draw: (ctx, size, detail) => drawOrganism(ctx, size, detail, view)
  }
}
