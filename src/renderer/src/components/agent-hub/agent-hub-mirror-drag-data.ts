import { agentHubPaneTargetKey } from './agent-hub-pane-target'
import { agentHubMirrorSourceKey, type AgentHubMirrorTab } from './agent-hub-mirror-membership'

export type AgentHubMirrorTabDrag = {
  kind: 'agent-hub-mirror-tab'
  windowId: string
  entryId: string
  target: string
  sourceKey: string
}

export function mirrorTabDragData(
  windowId: string,
  entry: AgentHubMirrorTab
): AgentHubMirrorTabDrag {
  return {
    kind: 'agent-hub-mirror-tab',
    windowId,
    entryId: entry.id,
    target: agentHubPaneTargetKey(entry.target),
    sourceKey: agentHubMirrorSourceKey(entry.target)
  }
}

export function isAgentHubMirrorTabDrag(value: unknown): value is AgentHubMirrorTabDrag {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'agent-hub-mirror-tab' &&
    'windowId' in value &&
    typeof value.windowId === 'string' &&
    'entryId' in value &&
    typeof value.entryId === 'string' &&
    'target' in value &&
    typeof value.target === 'string' &&
    'sourceKey' in value &&
    typeof value.sourceKey === 'string'
  )
}
