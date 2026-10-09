import { useAppStore } from '@/store'
import { getAgentLabel } from '@/lib/agent-catalog'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { agentHubMirrorWindows } from './agent-hub-mirror-membership'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import {
  addAgentHubMirrorTab,
  type AgentHubMirrorTabResult
} from './agent-hub-mirror-tab-operations'

/** The mirror window currently showing this workspace tab, window or minimized chip alike. */
export function findAgentHubMirrorWindowIdForTab(worktreeId: string, tabId: string): string | null {
  const window = agentHubMirrorWindows(readAgentHubMirrors()).find((candidate) =>
    candidate.tabs.some(
      (entry) => entry.target.tab.id === tabId && entry.target.worktree.id === worktreeId
    )
  )
  return window?.id ?? null
}

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
  const source = window?.tabs.find((entry) => entry.target.tab.id === args.sourceTabId)?.target
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
