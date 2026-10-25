import { useEffect, useRef } from 'react'
import { MicOff, VolumeX } from 'lucide-react'
import { agentHubOrbStateKey, type AgentHubOrbPhase } from './agent-hub-orb-phase'
import {
  agentHubOrbDetail,
  createAgentHubOrganism,
  type AgentHubOrganism
} from './agent-hub-orb-organism'
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
}

const MAX_DEVICE_PIXEL_RATIO = 2

export function AgentHubOrbSphere({
  phase,
  label,
  inputMuted = false,
  outputMuted = false,
  inputSpeaking = false,
  outcome = 'success',
  decorative = false
}: AgentHubOrbSphereProps): React.JSX.Element {
  const rootRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const organismRef = useRef<AgentHubOrganism | null>(null)
  const stateKey = agentHubOrbStateKey(phase, outcome)
  const stateKeyRef = useRef(stateKey)
  const inputSpeakingRef = useRef(inputSpeaking)
  const tint = useAgentHubOrbTint()

  useEffect(() => {
    stateKeyRef.current = stateKey
    organismRef.current?.setState(stateKey)
  }, [stateKey])

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
      organism.step(last ? (now - last) / 1000 : 0)
      last = now
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
    visibility.observe(root)

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
      {inputMuted || outputMuted ? (
        <span className="agent-hub-orb-mute-marks" aria-hidden>
          {outputMuted ? <VolumeX /> : null}
          {inputMuted ? <MicOff /> : null}
        </span>
      ) : null}
    </span>
  )
}
