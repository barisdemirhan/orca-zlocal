import { useId } from 'react'
import { Check, Minus, MicOff, ShieldCheck, VolumeX, HelpCircle, AlignLeft } from 'lucide-react'
import './agent-hub-orb-sphere.css'

export type AgentHubOrbPhase =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'request'
  | 'result'
  | 'error'
  | 'connecting'
  | 'stopping'
  | 'approval'
  | 'dictating'
  | 'transcribing'
  | 'off'

export type AgentHubOrbSphereProps = {
  phase: AgentHubOrbPhase
  label: string
  inputMuted?: boolean
  outputMuted?: boolean
  inputSpeaking?: boolean
  outcome?: 'success' | 'error'
  decorative?: boolean
}

export function AgentHubOrbSphere({
  phase,
  label,
  inputMuted = false,
  outputMuted = false,
  inputSpeaking = false,
  outcome = 'success',
  decorative = false
}: AgentHubOrbSphereProps): React.JSX.Element {
  const id = useId()
  const ribbon = `${id}-ribbon`
  const grain = `${id}-grain`
  return (
    <span
      className="agent-hub-orb-sphere"
      data-agent-hub-orb-phase={phase}
      data-input-muted={inputMuted}
      data-output-muted={outputMuted}
      data-input-speaking={inputSpeaking}
      data-outcome={outcome}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <span className="agent-hub-orb-halo" />
      <span className="agent-hub-orb-globe">
        <span className="agent-hub-orb-depth" />
        <span className="agent-hub-orb-flow agent-hub-orb-flow-a" />
        <span className="agent-hub-orb-flow agent-hub-orb-flow-b" />
        <svg className="agent-hub-orb-ribbons" viewBox="0 0 240 240" aria-hidden>
          <defs>
            <linearGradient id={ribbon} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="var(--foreground)" stopOpacity=".48" />
              <stop offset=".5" stopColor="var(--agent-hub-orb-tone)" stopOpacity=".64" />
              <stop offset="1" stopColor="var(--muted-foreground)" stopOpacity=".08" />
            </linearGradient>
          </defs>
          <g fill="none" stroke={`url(#${ribbon})`} strokeWidth="1">
            <path d="M-30 122C20 38 58 198 120 113S209 44 270 111" />
            <path d="M-30 128C20 49 60 202 120 119S209 49 270 119" />
            <path d="M-30 134C20 60 62 206 120 125S209 54 270 127" />
            <path d="M-30 140C20 71 64 210 120 131S209 59 270 135" />
            <path d="M-30 146C20 82 66 214 120 137S209 64 270 143" />
            <path d="M-30 152C20 93 68 218 120 143S209 69 270 151" />
            <path d="M-30 158C20 104 70 222 120 149S209 74 270 159" />
            <path d="M-30 164C20 115 72 226 120 155S209 79 270 167" />
          </g>
        </svg>
        <svg className="agent-hub-orb-grain" viewBox="0 0 240 240" aria-hidden>
          <filter id={grain}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".67"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="240" height="240" filter={`url(#${grain})`} />
        </svg>
        <span className="agent-hub-orb-shade" />
        <span className="agent-hub-orb-glint" />
        {[
          { key: 'request', icon: HelpCircle, active: phase === 'request' },
          { key: 'approval', icon: ShieldCheck, active: phase === 'approval' },
          { key: 'transcribing', icon: AlignLeft, active: phase === 'transcribing' },
          {
            key: 'error',
            icon: Minus,
            active: phase === 'error' || (phase === 'result' && outcome === 'error')
          },
          { key: 'success', icon: Check, active: phase === 'result' && outcome !== 'error' }
        ].map(({ key, icon: Icon, active }) => (
          <Icon key={key} className="agent-hub-orb-state-icon" data-active={active} aria-hidden />
        ))}
        <span className="agent-hub-orb-record-mark" data-active={phase === 'dictating'} />
      </span>
      {inputMuted || outputMuted ? (
        <span className="agent-hub-orb-mute-marks" aria-hidden>
          {outputMuted ? <VolumeX /> : null}
          {inputMuted ? <MicOff /> : null}
        </span>
      ) : null}
    </span>
  )
}
