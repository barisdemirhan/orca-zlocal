import {
  agentHubMirrorSourceKey,
  agentHubMirrorWindows,
  type AgentHubMirrorState,
  createAgentHubMirrorWindow,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubMirrorGeometry } from './agent-hub-mirror-geometry'
import {
  releaseAgentHubMirrorPlace,
  isAgentHubMirrorPlaceKept,
  keepAgentHubMirrorPlace,
  readAgentHubMirrorOrigin,
  rememberAgentHubMirrorOrigin
} from './agent-hub-mirror-places'

// A newly created window still honors the user's last chosen place for that source terminal.
const preferred = new Map<string, AgentHubMirrorGeometry>()
export function createAgentHubMirrorWindowAtPreferredPlace(
  target: AgentHubPaneTarget
): AgentHubMirrorWindowState {
  const window = createAgentHubMirrorWindow(target)
  const place = preferred.get(agentHubMirrorSourceKey(target))
  if (place) {
    rememberAgentHubMirrorOrigin(window.id, place)
    keepAgentHubMirrorPlace(window.id)
  }
  return window
}
export function rememberAgentHubMirrorSourcePlacesLeaving(
  previous: AgentHubMirrorState,
  next: AgentHubMirrorState
): void {
  const remaining = new Set(
    agentHubMirrorWindows(next).flatMap((window) =>
      window.tabs.map((tab) => agentHubMirrorSourceKey(tab.target))
    )
  )
  for (const window of agentHubMirrorWindows(previous)) {
    const place = readAgentHubMirrorOrigin(window.id)
    if (!place || !isAgentHubMirrorPlaceKept(window.id)) {
      continue
    }
    for (const tab of window.tabs) {
      const source = agentHubMirrorSourceKey(tab.target)
      if (!remaining.has(source)) {
        preferred.set(source, place)
      }
    }
  }
}
export function releaseAgentHubMirrorWindowPlace(window: AgentHubMirrorWindowState): void {
  releaseAgentHubMirrorPlace(window.id)
}
export function resetAgentHubMirrorSourcePlacesForTest(): void {
  preferred.clear()
}
