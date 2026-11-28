import { create } from 'zustand'
import { useAppStore } from '@/store'
import {
  normalizeAgentHubOrbMotion,
  type AgentHubOrbMotion
} from '../../../../shared/agent-hub-orb-motion-setting'
import { agentHubOrbMotionProfile, type OrbPoint } from './agent-hub-orb-motion'

/** A wake or sleep flight between the launcher and the stage, shared by the ghost and the real stage. */
export type AgentHubOrbFlight = {
  kind: 'wake' | 'return'
  /** The launcher's centre when the flight began; null grows or shrinks in place. */
  slot: OrbPoint | null
  startedAt: number
}

type AgentHubOrbFlightState = {
  /** The sphere stands in before the host has opened, so a press answers at once. */
  waking: boolean
  flight: AgentHubOrbFlight | null
}

export const useAgentHubOrbFlight = create<AgentHubOrbFlightState>(() => ({
  waking: false,
  flight: null
}))

export function readAgentHubOrbMotion(): AgentHubOrbMotion {
  return normalizeAgentHubOrbMotion(useAppStore.getState().settings?.agentHubOrbMotion)
}

/** The launcher on screen: the dock button, the status bar item or the floating button. */
export function readAgentHubOrbSlot(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>('[data-agent-hub-orb-slot]')) {
    const box = element.getBoundingClientRect()
    if (box.width > 0 && box.height > 0) {
      return element
    }
  }
  return null
}

export function agentHubOrbSlotCentre(): OrbPoint | null {
  const box = readAgentHubOrbSlot()?.getBoundingClientRect()
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null
}

function startFlight(kind: AgentHubOrbFlight['kind']): AgentHubOrbFlight | null {
  return agentHubOrbMotionProfile(readAgentHubOrbMotion()).transitions
    ? { kind, slot: agentHubOrbSlotCentre(), startedAt: performance.now() }
    : null
}

export function pressAgentHubOrbSlot(): void {
  readAgentHubOrbSlot()?.animate?.(
    [{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }, { transform: 'scale(1)' }],
    { duration: 220, easing: 'ease-out' }
  )
}

export function pulseAgentHubOrbSlot(): void {
  readAgentHubOrbSlot()?.animate?.(
    [{ boxShadow: '0 0 0 0 var(--ring)' }, { boxShadow: '0 0 0 9px transparent' }],
    { duration: 500 }
  )
}

export function beginAgentHubOrbWake(): void {
  if (agentHubOrbMotionProfile(readAgentHubOrbMotion()).transitions) {
    pressAgentHubOrbSlot()
  }
  useAgentHubOrbFlight.setState({ waking: true, flight: startFlight('wake') })
}

export function endAgentHubOrbWake(): void {
  useAgentHubOrbFlight.setState({ waking: false })
}

/** The host would not open: the sphere goes back to where it came from. */
export function failAgentHubOrbWake(): void {
  useAgentHubOrbFlight.setState({ flight: startFlight('return') })
}

export function beginAgentHubOrbReturn(): void {
  useAgentHubOrbFlight.setState({ flight: startFlight('return') })
}

export function finishAgentHubOrbFlight(flight: AgentHubOrbFlight): void {
  if (useAgentHubOrbFlight.getState().flight === flight) {
    useAgentHubOrbFlight.setState({ flight: null })
  }
}
