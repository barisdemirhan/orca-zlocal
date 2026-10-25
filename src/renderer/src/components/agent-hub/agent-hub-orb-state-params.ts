import type { AgentHubOrbStateKey } from './agent-hub-orb-phase'
import {
  mixOrbRgb,
  type AgentHubOrbPalette,
  type OrbRgb,
  type OrbStateParams
} from './agent-hub-orb-palette'

const WHITE: OrbRgb = [255, 255, 255]
const BLACK: OrbRgb = [0, 0, 0]

const BASE: OrbStateParams = {
  scale: 0.86,
  breathHz: 0.2,
  breathAmp: 0.03,
  a2: 0.025,
  a3: 0.016,
  a5: 0.008,
  lobeSpeed: 0.35,
  jitter: 0,
  core: [0, 0, 0],
  rim: [0, 0, 0],
  glow: 0.2,
  nucleus: 0.35,
  nucleusTint: [0, 0, 0],
  pCount: 0.4,
  pSpeed: 0.25,
  swirl: 0.15,
  radial: 0,
  reach: 0,
  reachDir: -Math.PI / 4,
  beat1: 0,
  beat2: 0,
  beatPeriod: 1.6,
  rippleEvery: 0,
  squashY: 1,
  audioIn: 0,
  audioOut: 0,
  orbitRing: 0,
  dim: 0
}

type StateOverrides = Partial<Omit<OrbStateParams, 'core' | 'rim' | 'nucleusTint'>>

export function buildOrbStateParams(
  palette: AgentHubOrbPalette
): Record<AgentHubOrbStateKey, OrbStateParams> {
  // Light themes keep rims closer to the token so the membrane stays visible on white.
  const lift = palette.dark ? 0.45 : 0.25
  const rimOf = (core: OrbRgb): OrbRgb => mixOrbRgb(core, WHITE, lift)
  const make = (
    core: OrbRgb,
    overrides: StateOverrides,
    extra: { rim?: OrbRgb; nucleusTint?: OrbRgb } = {}
  ): OrbStateParams => {
    const rim = extra.rim ?? rimOf(core)
    return { ...BASE, ...overrides, core, rim, nucleusTint: extra.nucleusTint ?? rim }
  }
  const idleCore = palette.idle ?? mixOrbRgb(palette.ring, palette.muted, 0.5)
  const sleepCore = mixOrbRgb(idleCore, BLACK, palette.dark ? 0.6 : 0.2)
  const errorCore = mixOrbRgb(palette.destructive, palette.muted, 0.3)
  const speakCore = mixOrbRgb(palette.listening, palette.foreground, 0.55)
  const L = palette.listening
  return {
    off: make(sleepCore, {
      scale: 0.66,
      breathHz: 0.11,
      breathAmp: 0.025,
      a2: 0.012,
      a3: 0.006,
      a5: 0.003,
      lobeSpeed: 0.12,
      glow: 0.04,
      nucleus: 0.1,
      pCount: 0.08,
      pSpeed: 0.08,
      dim: 0.35
    }),
    idle: make(idleCore, {}),
    connecting: make(L, {
      scale: 0.8,
      breathHz: 0.5,
      breathAmp: 0.025,
      glow: 0.2,
      pCount: 0.7,
      pSpeed: 0.6,
      radial: -1,
      swirl: 0.5,
      orbitRing: 1,
      dim: 0.15
    }),
    listening: make(L, {
      scale: 0.95,
      breathHz: 0.25,
      a2: 0.03,
      a3: 0.02,
      a5: 0.012,
      glow: 0.36,
      nucleus: 0.4,
      pCount: 0.6,
      pSpeed: 0.35,
      radial: 0.3,
      reach: 0.05,
      reachDir: Math.PI / 2,
      audioIn: 1
    }),
    dictating: make(
      L,
      {
        scale: 0.9,
        a2: 0.022,
        a3: 0.016,
        glow: 0.28,
        nucleus: 0.55,
        pCount: 0.45,
        pSpeed: 0.3,
        radial: 0.2,
        reach: 0.04,
        reachDir: Math.PI / 2,
        audioIn: 1
      },
      { nucleusTint: palette.destructive }
    ),
    transcribing: make(
      L,
      {
        scale: 0.82,
        breathHz: 0.7,
        breathAmp: 0.015,
        a2: 0.014,
        a3: 0.01,
        glow: 0.22,
        pCount: 0.8,
        pSpeed: 0.7,
        radial: -1,
        swirl: 0.2,
        squashY: 0.9
      },
      { rim: mixOrbRgb(L, WHITE, palette.dark ? 0.7 : 0.45) }
    ),
    speaking: make(speakCore, {
      scale: 0.98,
      breathHz: 0.3,
      a2: 0.035,
      a3: 0.022,
      a5: 0.01,
      lobeSpeed: 0.6,
      glow: 0.45,
      nucleus: 0.5,
      pCount: 0.55,
      pSpeed: 0.5,
      radial: 1,
      audioOut: 1
    }),
    stopping: make(
      palette.muted,
      {
        scale: 0.7,
        breathHz: 0.12,
        glow: 0.06,
        nucleus: 0.15,
        pCount: 0.15,
        pSpeed: 0.15,
        radial: -0.4,
        dim: 0.25
      },
      { rim: palette.ring }
    ),
    thinking: make(palette.working, {
      scale: 0.88,
      breathHz: 0.35,
      breathAmp: 0.02,
      a2: 0.02,
      a3: 0.04,
      a5: 0.028,
      lobeSpeed: 1.4,
      glow: 0.3,
      nucleus: 0.45,
      pCount: 1,
      pSpeed: 1,
      swirl: 1
    }),
    attention: make(palette.attention, {
      scale: 0.88,
      glow: 0.3,
      nucleus: 0.4,
      reach: 0.07,
      rippleEvery: 4
    }),
    request: make(palette.question, {
      scale: 0.9,
      a2: 0.018,
      a3: 0.012,
      glow: 0.38,
      nucleus: 0.45,
      pCount: 0.5,
      pSpeed: 0.3,
      radial: 0.3,
      reach: 0.2,
      beat1: 1,
      beatPeriod: 1.6
    }),
    approval: make(palette.warning, {
      scale: 0.9,
      a2: 0.012,
      a3: 0.008,
      glow: 0.42,
      nucleus: 0.5,
      pCount: 0.4,
      pSpeed: 0.25,
      reach: 0.14,
      beat2: 1,
      beatPeriod: 1.3,
      squashY: 1.05
    }),
    success: make(palette.success, {
      scale: 0.9,
      breathHz: 0.18,
      a2: 0.014,
      a3: 0.008,
      glow: 0.34,
      nucleus: 0.4,
      pCount: 0.35,
      pSpeed: 0.2,
      radial: 0.4
    }),
    error: make(errorCore, {
      scale: 0.84,
      breathHz: 0.14,
      a2: 0.016,
      a3: 0.01,
      jitter: 0.012,
      glow: 0.26,
      nucleus: 0.25,
      pCount: 0.3,
      pSpeed: 0.15,
      radial: -0.2,
      squashY: 0.95,
      dim: 0.1
    })
  }
}
