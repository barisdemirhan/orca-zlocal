import type { AppState } from '@/store/types'
import type { StructuredChatTabNames } from '@/runtime/native-chat/naming/structured-chat-tab-name'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TerminalAgent } from '../../../../shared/agent-status/identity/terminal-agent'
import { isStructuredTab } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import { terminalTabFromAgentSessionTab } from '../activity/activity-event-builder-context'

type ChatTabState = Partial<Pick<AppState, 'unifiedTabsByWorktree'>>

const NO_NAMES: StructuredChatTabNames = new Map()

/** Standalone chats of real workspaces; the floating panel keeps its own dashboard preview. */
function* agentHubChatTabs(state: ChatTabState): Generator<Tab> {
  for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree ?? {})) {
    if (worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
      continue
    }
    for (const tab of tabs) {
      if (isStructuredTab(tab)) {
        yield tab
      }
    }
  }
}

export function findAgentHubChatTab(state: ChatTabState, tabId: string): Tab | null {
  for (const tab of agentHubChatTabs(state)) {
    if (tab.id === tabId) {
      return tab
    }
  }
  return null
}

export function isAgentHubChatTab(state: ChatTabState, tabId: string): boolean {
  return findAgentHubChatTab(state, tabId) !== null
}

/** A chat in the shape hub rows and mirror targets carry for a tab. */
export function agentHubChatTerminalTab(tab: Tab): TerminalTab {
  return terminalTabFromAgentSessionTab(tab, NO_NAMES)
}

export function agentHubChatSession(chat: Tab): {
  sessionId: string
  agent: Tab['agentSessionAgent']
} {
  return { sessionId: chat.entityId, agent: chat.agentSessionAgent }
}

export function agentHubChatAgents(state: ChatTabState): ReadonlyMap<string, TerminalAgent> {
  const agents = new Map<string, TerminalAgent>()
  for (const tab of agentHubChatTabs(state)) {
    if (tab.agentSessionAgent) {
      agents.set(tab.id, tab.agentSessionAgent as TerminalAgent)
    }
  }
  return agents
}

/** Every tab the hub lists per workspace: terminals, then chats. */
export function agentHubTabsByWorktree(
  state: ChatTabState & Pick<AppState, 'tabsByWorktree'>
): Readonly<Record<string, readonly TerminalTab[]>> {
  let merged: Record<string, readonly TerminalTab[]> | null = null
  for (const tab of agentHubChatTabs(state)) {
    merged ??= { ...state.tabsByWorktree }
    merged[tab.worktreeId] = [...(merged[tab.worktreeId] ?? []), agentHubChatTerminalTab(tab)]
  }
  return merged ?? state.tabsByWorktree
}
