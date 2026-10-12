import { resolveAgentHubMirrorTarget } from './agent-hub-mirror-source'
import { createAgentHubMirrorWindowAtPreferredPlace as createAgentHubMirrorWindow } from './agent-hub-mirror-source-places'
import {
  clearAgentHubMirrorViewing,
  agentHubMirrorSourceKey,
  hasAgentHubMirrorEntryRoom,
  findAgentHubMirrorMembership,
  selectAgentHubMirrorTarget,
  replaceAgentHubMirrorWindow,
  type AgentHubMirrorState,
  type AgentHubMirrorWindowState
} from './agent-hub-mirror-membership'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  raiseAgentHubMirrorWindow,
  AGENT_HUB_MIRROR_CHIP_CAP
} from './agent-hub-mirror-window-stack'
/** First request per owner wins; existing grouped windows are never split by Pop out all. */
export function prepareAgentHubMirrorBatch(
  state: AgentHubMirrorState,
  targets: readonly AgentHubPaneTarget[],
  windowCap: number
): AgentHubMirrorState | null {
  let next = state
  const requested: AgentHubMirrorWindowState[] = []
  const seen = new Set<string>()
  const sources = new Set<string>()
  for (const request of targets) {
    const target = resolveAgentHubMirrorTarget(request)
    if (!target) {
      continue
    }
    const source = agentHubMirrorSourceKey(target)
    if (sources.has(source)) {
      continue
    }
    sources.add(source)
    const membership = findAgentHubMirrorMembership(next, target)
    const owner = membership?.kind === 'tab' ? membership : null
    if (owner && seen.has(owner.window.id)) {
      continue
    }
    if (!owner && !hasAgentHubMirrorEntryRoom(next)) {
      break
    }
    if (membership?.kind === 'viewing') {
      next = clearAgentHubMirrorViewing(next, (entry) => agentHubMirrorSourceKey(entry) === source)
    }
    const window = owner
      ? selectAgentHubMirrorTarget(owner.window, owner.tab.id, target)
      : createAgentHubMirrorWindow(target)
    seen.add(window.id)
    requested.push(window)
    next = owner
      ? replaceAgentHubMirrorWindow(next, window.id, window)
      : { ...next, chips: [...next.chips, { window, minimizedAt: Date.now() }] }
  }
  for (const window of requested.slice(0, windowCap).toReversed()) {
    next = raiseAgentHubMirrorWindow(next, window, windowCap)
  }
  return requested.length ? { ...next, chips: next.chips.slice(-AGENT_HUB_MIRROR_CHIP_CAP) } : null
}
