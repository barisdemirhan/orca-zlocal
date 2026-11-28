import type { AgentHubRect } from './agent-hub-floating-arrange'
import { defaultAgentHubMirrorSize } from './agent-hub-mirror-geometry'

type Size = { width: number; height: number }

// Peek is a passing look: it takes at most this share of the work area unless made full screen.
const MAX_SHARE = 0.7
const FULL_SCREEN_INSET = 16
// The header plus the viewer's padding and toolbar around an image or a video.
const VIEWER_CHROME: Size = { width: 48, height: 140 }

/**
 * Where Peek sits: centered, no larger than 70% of the work area, as small as its content (an
 * image or video smaller than that), but never smaller than a new mirror window.
 */
export function agentHubPeekGeometry(
  area: AgentHubRect,
  content: Size | null,
  fullScreen: boolean
): AgentHubRect {
  if (fullScreen) {
    return {
      left: area.left + FULL_SCREEN_INSET,
      top: area.top + FULL_SCREEN_INSET,
      width: Math.max(0, area.width - FULL_SCREEN_INSET * 2),
      height: Math.max(0, area.height - FULL_SCREEN_INSET * 2)
    }
  }
  const max = { width: area.width * MAX_SHARE, height: area.height * MAX_SHARE }
  const mirror = defaultAgentHubMirrorSize({ width: area.width, height: area.height })
  const fit = (desired: number, floor: number, ceiling: number): number =>
    Math.round(Math.min(ceiling, Math.max(Math.min(floor, ceiling), desired)))
  const width = fit(
    content ? content.width + VIEWER_CHROME.width : max.width,
    mirror.width,
    max.width
  )
  const height = fit(
    content ? content.height + VIEWER_CHROME.height : max.height,
    mirror.height,
    max.height
  )
  return {
    left: Math.round(area.left + (area.width - width) / 2),
    top: Math.round(area.top + (area.height - height) / 2),
    width,
    height
  }
}
