import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { activateAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import { highlightAgentHubMirror } from './agent-hub-mirror-signals'
import {
  openAgentHubMirrorInLayout,
  rearrangeAgentHubMirrorsByDefault
} from './agent-hub-floating-arrangement'
import { readAgentHubMirrors, restoreAgentHubMirror } from './agent-hub-mirror-store'

/** Hub rows raise a viewed member without turning it into a new window. */
export function showAgentHubMirrorMember(target: AgentHubPaneTarget): void {
  const owner = findAgentHubMirrorMembership(readAgentHubMirrors(), target)
  if (owner?.kind !== 'viewing') {
    openAgentHubMirrorInLayout(target)
    return
  }
  if (owner.presence === 'chip') {
    restoreAgentHubMirror(owner.window.id)
    rearrangeAgentHubMirrorsByDefault()
  }
  activateAgentHubMirrorTab(owner.window.id, owner.tab.id)
  highlightAgentHubMirror(owner.window.id)
}
