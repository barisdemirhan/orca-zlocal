import { useEffect, useRef } from 'react'
import { MicOff, VolumeX } from 'lucide-react'
import { agentHubOrbStateKey, type AgentHubOrbPhase } from './agent-hub-orb-phase'
import {
  agentHubOrbDetail,
  createAgentHubOrganism,
  type AgentHubOrbOrbit,
  type AgentHubOrganism
} from './agent-hub-orb-organism'
import { useAppStore } from '@/store'
import { normalizeAgentHubOrbMotion } from '../../../../shared/agent-hub-orb-motion-setting'
import { readAgentHubOrbPalette } from './agent-hub-orb-palette'
import { useAgentHubOrbTint } from './use-agent-hub-orb-identity'
import './agent-hub-orb-sphere.css'

export type { AgentHubOrbPhase }

export type AgentHubOrbSphereProps = {
  phase: AgentHubOrbPhase
  label: string
  inputMuted?: boolean
  outputMuted?: boolean
  inputSpeaking?: boolean
  outcome?: 'success' | 'error'
  decorative?: boolean
  /** How many asks wait on the owner; a small count sits on the sphere. */
  badge?: number
  /** The Orb's own automation is running: a thin arc turns around the sphere. */
  orbit?: boolean
  /** A ring in the success or error colour, once per id. */
  ring?: { id: number; tone: 'success' | 'error' } | null
}

/** Called from the canvas loop after each step; the stage's motion writes the sphere's transform here. */
export type AgentHubOrbFrame = {
  dt: number
  now: number
  root: HTMLElement
  pulse: () => void
}
type AgentHubOrbFrameHandler = (frame: AgentHubOrbFrame) => void

const MAX_DEVICE_PIXEL_RATIO = 2

export function AgentHubOrbSphere({
  phase,
  label,
  inputMuted = false,
  outputMuted = false,
  inputSpeaking = false,
  outcome = 'success',
  decorative = false,
  badge = 0,
  orbit = false,
  ring = null,
  onFrame
}: AgentHubOrbSphereProps & { onFrame?: AgentHubOrbFrameHandler }): React.JSX.Element {
  const rootRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const organismRef = useRef<AgentHubOrganism | null>(null)
  const stateKey = agentHubOrbStateKey(phase, outcome)
  const stateKeyRef = useRef(stateKey)
  const inputSpeakingRef = useRef(inputSpeaking)
  const onFrameRef = useRef(onFrame)
  const tint = useAgentHubOrbTint()
  const motion = useAppStore((s) => normalizeAgentHubOrbMotion(s.settings?.agentHubOrbMotion))
  const orbitMode: AgentHubOrbOrbit = !orbit ? 'off' : motion === 'off' ? 'still' : 'spin'
  const orbitModeRef = useRef(orbitMode)
  const ringId = ring?.id
  const ringTone = ring?.tone
  const ringSeen = useRef(ringId)

  useEffect(() => {
    stateKeyRef.current = stateKey
    organismRef.current?.setState(stateKey)
  }, [stateKey])

  useEffect(() => {
    orbitModeRef.current = orbitMode
    organismRef.current?.setOrbit(orbitMode)
  }, [orbitMode])

  useEffect(() => {
    // Why: a ring that was already there when the sphere mounted is old news.
    if (ringId !== undefined && ringId !== ringSeen.current && ringTone) {
      organismRef.current?.pulse(ringTone)
    }
    ringSeen.current = ringId
  }, [ringId, ringTone])

  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  useEffect(() => {
    inputSpeakingRef.current = inputSpeaking
    organismRef.current?.setInputActive(inputSpeaking)
  }, [inputSpeaking])

  useEffect(() => {
    // Why: the data-orb-tint attribute changes the --agent-orb-idle custom property on the root.
    const root = rootRef.current
    if (root) {
      organismRef.current?.setPalette(readAgentHubOrbPalette(root))
    }
  }, [tint])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!root || !canvas || !ctx) {
      return
    }
    const organism = createAgentHubOrganism(stateKeyRef.current, readAgentHubOrbPalette(root))
    organism.setInputActive(inputSpeakingRef.current)
    organism.setOrbit(orbitModeRef.current)
    organismRef.current = organism

    let size = 0
    let onScreen = true
    let frame = 0
    let last = 0

    const paint = (): void => {
      if (size > 0) {
        organism.draw(ctx, size, agentHubOrbDetail(size))
      }
    }
    const shouldRun = (): boolean => size > 0 && onScreen && !document.hidden
    const tick = (now: number): void => {
      frame = 0
      if (!shouldRun()) {
        return
      }
      const dt = last ? (now - last) / 1000 : 0
      organism.step(dt)
      last = now
      onFrameRef.current?.({ dt, now, root, pulse: organism.pulse })
      paint()
      frame = requestAnimationFrame(tick)
    }
    const sync = (): void => {
      if (shouldRun()) {
        if (!frame) {
          last = 0
          frame = requestAnimationFrame(tick)
        }
      } else if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }

    const resize = new ResizeObserver(() => {
      const next = Math.floor(Math.min(root.clientWidth, root.clientHeight))
      if (next === size) {
        return
      }
      size = next
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
      canvas.width = Math.max(1, Math.round(size * dpr))
      canvas.height = canvas.width
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      ctx.setTransform(
        canvas.width / Math.max(size, 1),
        0,
        0,
        canvas.width / Math.max(size, 1),
        0,
        0
      )
      paint()
      sync()
    })
    resize.observe(root)

    const visibility = new IntersectionObserver((entries) => {
      onScreen = entries.at(-1)?.isIntersecting ?? true
      sync()
    })
    // The resting box: a flight carries `root` off screen, and stopping there would strand it.
    visibility.observe(root.parentElement ?? root)

    const theme = new MutationObserver(() => organism.setPalette(readAgentHubOrbPalette(root)))
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style']
    })
    document.addEventListener('visibilitychange', sync)

    return () => {
      resize.disconnect()
      visibility.disconnect()
      theme.disconnect()
      document.removeEventListener('visibilitychange', sync)
      if (frame) {
        cancelAnimationFrame(frame)
      }
      organismRef.current = null
    }
  }, [])

  return (
    <span
      ref={rootRef}
      className="agent-hub-orb-sphere"
      data-orb-tint={tint === 'silver' ? undefined : tint}
      data-agent-hub-orb-phase={phase}
      data-input-muted={inputMuted}
      data-output-muted={outputMuted}
      data-input-speaking={inputSpeaking}
      data-outcome={outcome}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <canvas ref={canvasRef} className="agent-hub-orb-canvas" aria-hidden />
      {badge > 0 ? (
        <span className="agent-hub-orb-badge" aria-hidden>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
      {inputMuted || outputMuted ? (
        <span className="agent-hub-orb-mute-marks" aria-hidden>
          {outputMuted ? <VolumeX /> : null}
          {inputMuted ? <MicOff /> : null}
        </span>
      ) : null}
    </span>
  )
}
