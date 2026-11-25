import { recomputeOn } from '@/lib/recompute-on'
import { isAgentHubCanvasOpen } from './agent-hub-canvas-store'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import { useAgentHubMirrorFocus, type AgentHubMirrorFocusState } from './agent-hub-mirror-focus'
import {
  agentHubMirrorFocusGeometry,
  type AgentHubMirrorGeometry
} from './agent-hub-mirror-geometry'
import { useAgentHubWorkAreaKey } from './use-agent-hub-work-area-key'
import { useViewportSize } from './use-viewport-size'

/**
 * How one mirror stands while a mirror is focused on the canvas, and the box the focused one
 * shows in. The box follows the work area (the window resizing, the sidebar, the status bar).
 */
export function useMirrorWindowFocus(key: string): {
  state: AgentHubMirrorFocusState
  box: AgentHubMirrorGeometry | null
} {
  const focusedKey = useAgentHubMirrorFocus()
  const focused = focusedKey === key
  const viewport = useViewportSize()
  const areaKey = useAgentHubWorkAreaKey()
  const box = focused
    ? recomputeOn([areaKey], () =>
        agentHubMirrorFocusGeometry(agentHubWorkArea(), viewport, isAgentHubCanvasOpen())
      )
    : null
  return { state: focused ? 'focused' : focusedKey === null ? null : 'shadowed', box }
}
