import {
  AGENT_HUB_ORB_VISIBLE_RADIUS,
  type AgentHubOrbBounds,
  type AgentHubOrbOverhang
} from './agent-hub-orb-geometry'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'

export const NO_AGENT_HUB_ORB_OVERHANG: AgentHubOrbOverhang = { top: 0, bottom: 0 }

/** Only the drawn sphere, the hover pill and an open writing box have to stay inside the bounds. */
export function measureAgentHubOrbOverhang(
  shell: HTMLElement | null,
  quick: HTMLElement | null,
  modelHeight: number,
  quickOpen: boolean
): AgentHubOrbOverhang {
  const sphere = shell?.querySelector('.agent-hub-orb-art-sphere')
  if (!shell || !(sphere instanceof HTMLElement) || !sphere.offsetHeight) {
    return NO_AGENT_HUB_ORB_OVERHANG
  }
  const box = shell.getBoundingClientRect()
  const canvas = sphere.getBoundingClientRect()
  const glow = canvas.height * (0.5 - AGENT_HUB_ORB_VISIBLE_RADIUS)
  const pill = shell.querySelector<HTMLElement>('.agent-hub-orb-hover-controls')?.offsetHeight ?? 0
  const lowest = quickOpen && quick ? quick.getBoundingClientRect().bottom : canvas.bottom - glow
  return {
    top: Math.max(0, Math.round(canvas.top + glow - box.top - pill)),
    bottom: Math.max(0, Math.round(box.top + modelHeight - lowest))
  }
}

/** Lifts a saved Orb whose writing box opened against the bottom edge, rather than shrinking it. */
export function liftAgentHubOrbAboveBottom(
  bounds: AgentHubOrbBounds,
  overhang: AgentHubOrbOverhang,
  height: number
): void {
  const saved = useAgentHubOrbPanel.getState().stagePosition
  const lowest = bounds.bottom + overhang.bottom - height
  if (saved && saved.y > lowest) {
    useAgentHubOrbPanel.setState({
      stagePosition: { x: saved.x, y: Math.max(bounds.top, lowest) }
    })
  }
}

export function clampAgentHubOrbPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  bounds: AgentHubOrbBounds,
  overhang: AgentHubOrbOverhang
): { x: number; y: number } {
  return {
    x: Math.max(bounds.left, Math.min(bounds.right - size.width, position.x)),
    y: Math.max(
      bounds.top - overhang.top,
      Math.min(bounds.bottom + overhang.bottom - size.height, position.y)
    )
  }
}
