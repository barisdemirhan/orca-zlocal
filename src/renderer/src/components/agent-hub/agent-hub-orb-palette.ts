export type OrbRgb = [number, number, number]

export type AgentHubOrbPalette = {
  listening: OrbRgb
  working: OrbRgb
  attention: OrbRgb
  question: OrbRgb
  warning: OrbRgb
  success: OrbRgb
  destructive: OrbRgb
  ring: OrbRgb
  muted: OrbRgb
  foreground: OrbRgb
  /** The user's idle tint; absent means the neutral silver look. */
  idle?: OrbRgb
  dark: boolean
}

export type OrbStateParams = {
  scale: number
  breathHz: number
  breathAmp: number
  a2: number
  a3: number
  a5: number
  lobeSpeed: number
  jitter: number
  core: OrbRgb
  rim: OrbRgb
  glow: number
  nucleus: number
  nucleusTint: OrbRgb
  pCount: number
  pSpeed: number
  swirl: number
  radial: number
  reach: number
  reachDir: number
  beat1: number
  beat2: number
  beatPeriod: number
  rippleEvery: number
  squashY: number
  audioIn: number
  audioOut: number
  orbitRing: number
  dim: number
}

export function mixOrbRgb(a: OrbRgb, b: OrbRgb, k: number): OrbRgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

// Fallback used until theme tokens are readable (tests, first paint).
export const FALLBACK_ORB_PALETTE: AgentHubOrbPalette = {
  listening: [59, 130, 246],
  working: [99, 102, 241],
  attention: [125, 211, 252],
  question: [249, 115, 22],
  warning: [202, 138, 4],
  success: [34, 197, 94],
  destructive: [228, 0, 20],
  ring: [115, 115, 115],
  muted: [115, 115, 115],
  foreground: [250, 250, 250],
  dark: true
}

const TOKEN_FALLBACK = FALLBACK_ORB_PALETTE
let probe: CanvasRenderingContext2D | null | undefined

function resolveColor(value: string, fallback: OrbRgb): OrbRgb {
  if (probe === undefined) {
    probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  }
  if (!probe || !value.trim()) {
    return fallback
  }
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = value.trim()
  probe.fillRect(0, 0, 1, 1)
  const data = probe.getImageData(0, 0, 1, 1).data
  return [data[0], data[1], data[2]]
}

export function readAgentHubOrbPalette(element: Element): AgentHubOrbPalette {
  const style = getComputedStyle(element)
  const read = (token: string, fallback: OrbRgb): OrbRgb =>
    resolveColor(style.getPropertyValue(token), fallback)
  const background = read('--background', [10, 10, 10])
  const idleToken = style.getPropertyValue('--agent-orb-idle').trim()
  const luminance = (background[0] * 0.299 + background[1] * 0.587 + background[2] * 0.114) / 255
  return {
    listening: read('--agent-orb-listening', TOKEN_FALLBACK.listening),
    working: read('--agent-orb-working', TOKEN_FALLBACK.working),
    attention: read('--agent-orb-attention', TOKEN_FALLBACK.attention),
    question: read('--agent-question-text', TOKEN_FALLBACK.question),
    warning: read('--status-warning', TOKEN_FALLBACK.warning),
    success: read('--status-success', TOKEN_FALLBACK.success),
    destructive: read('--destructive', TOKEN_FALLBACK.destructive),
    ring: read('--ring', TOKEN_FALLBACK.ring),
    muted: read('--muted-foreground', TOKEN_FALLBACK.muted),
    foreground: read('--foreground', TOKEN_FALLBACK.foreground),
    idle: idleToken ? read('--agent-orb-idle', TOKEN_FALLBACK.ring) : undefined,
    dark: luminance < 0.5
  }
}
