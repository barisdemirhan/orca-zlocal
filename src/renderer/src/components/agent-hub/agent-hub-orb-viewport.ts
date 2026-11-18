import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../../app-shell/chrome/workspace-chrome-metrics'
import type { AgentHubOrbBounds } from './agent-hub-orb-geometry'

export function readAgentHubOrbBounds(): AgentHubOrbBounds {
  const bounds = {
    left: 12,
    right: Math.max(12, window.innerWidth - 12),
    top: WORKSPACE_TOP_CHROME_HEIGHT + 12,
    bottom: Math.max(
      WORKSPACE_TOP_CHROME_HEIGHT + 12,
      window.innerHeight - STATUS_BAR_RESERVE_HEIGHT - 12
    )
  }
  const dock = document.querySelector<HTMLElement>('[data-agent-hub-dock]')
  const box = dock?.getBoundingClientRect()
  const edge = dock?.dataset.edge
  if (box && edge !== undefined && box.width > 0 && box.height > 0) {
    switch (edge) {
      case 'top':
        bounds.top = Math.max(bounds.top, box.bottom + 12)
        break
      case 'left':
        bounds.left = Math.max(bounds.left, box.right + 12)
        break
      case 'right':
        bounds.right = Math.min(bounds.right, box.left - 12)
        break
      default:
        bounds.bottom = Math.min(bounds.bottom, box.top - 12)
    }
  }
  return bounds
}
