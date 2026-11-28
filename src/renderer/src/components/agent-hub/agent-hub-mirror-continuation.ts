import { useAppStore } from '@/store'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { agentHubMirrorWindows, shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import {
  addAgentHubMirrorTab,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

/** Mirrors a freshly launched session as a tab of the mirror window its source pane lives in. */
export function addLaunchedSessionToAgentHubMirror(args: {
  windowId: string
  worktreeId: string
  sourceTabId: string
  newTabId: string
  agent: TuiAgent
}): AgentHubMirrorTabResult {
  const window = agentHubMirrorWindows(readAgentHubMirrors()).find(
    (candidate) => candidate.id === args.windowId
  )
  const source = window?.tabs
    .map(shownAgentHubMirrorTarget)
    .find((entry) => entry.tab.id === args.sourceTabId)
  const tab = useAppStore
    .getState()
    .tabsByWorktree[args.worktreeId]?.find((entry) => entry.id === args.newTabId)
  if (!source || !tab) {
    return { status: 'missing-source' }
  }
  // Why: the op re-resolves worktree, repo and tab from live state; only identity is needed here.
  return addAgentHubMirrorTab(args.windowId, {
    ...source,
    tab,
    paneKey: null,
    title: getAgentLabel(args.agent),
    agentType: args.agent
  })
}
