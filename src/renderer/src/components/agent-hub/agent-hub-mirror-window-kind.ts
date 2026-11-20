import type { AgentHubMirrorWindowState } from './agent-hub-mirror-membership'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubIndicatorKind } from './agent-hub-lists'

const PRIORITY: readonly AgentHubIndicatorKind[] = ['ask', 'done', 'work', 'read', 'idle']
export function agentHubMirrorWindowKind(
  window: AgentHubMirrorWindowState,
  kindOf: (target: AgentHubPaneTarget) => AgentHubIndicatorKind
): AgentHubIndicatorKind {
  const kinds = new Set(window.tabs.map((tab) => kindOf(tab.target)))
  return PRIORITY.find((kind) => kinds.has(kind)) ?? 'idle'
}
