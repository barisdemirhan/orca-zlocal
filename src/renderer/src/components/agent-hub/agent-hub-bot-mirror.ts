import { openBotChat } from '@/lib/bot-catalog'
import { openDesktopStructuredSessionInteraction } from '@/lib/agent-session/open/open-existing-structured-session'
import { showChatOpenUnavailable } from '@/lib/agent-session/open/chat-open-failure-toast'
import { useAppStore } from '@/store'
import type { Bot } from '../../../../shared/bot-types'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { agentHubTerminalTreeFromState } from './use-agent-hub-terminal-tree'
import { paneTargetFromTerminalRow, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type { AgentHubTerminalRow } from './agent-hub-terminal-tree'
import { findAgentHubMirrorMembership } from './agent-hub-mirror-membership'
import { readAgentHubMirrors } from './agent-hub-mirror-store'
import { revealAgentHubTargetInSidebar } from './agent-hub-sidebar-reveal'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { openAgentHubOrbSideChat } from './agent-hub-orb-side-chat'
import { popOutAgentHubTab } from './agent-hub-tab-popout'
import { selectAgentHubMirrorFamilyMember } from './agent-hub-mirror-tab-actions'

function findChatTarget(tabId: string): AgentHubPaneTarget | null {
  const find = (rows: readonly AgentHubTerminalRow[]): AgentHubPaneTarget | null => {
    for (const row of rows) {
      const target = paneTargetFromTerminalRow(row)
      if (target.tab.id === tabId) {
        return target
      }
      const child = find(row.children)
      if (child) {
        return child
      }
    }
    return null
  }
  for (const group of agentHubTerminalTreeFromState(useAppStore.getState(), [], true, new Map())) {
    for (const workspace of group.workspaces) {
      const found = find(workspace.rows)
      if (found) {
        return found
      }
    }
  }
  return null
}

/** The pane target of one of the bot's chats (its Home chat when `sessionId` is null), its tab
 *  opened in the background so the workspace on screen stays where it is; null when it won't open. */
export async function resolveBotChatTarget(
  bot: Bot,
  sessionId: string | null
): Promise<AgentHubPaneTarget | null> {
  const id = sessionId ?? (await openBotChat(bot).catch(() => null))
  if (!id) {
    return null
  }
  const result = await openDesktopStructuredSessionInteraction(
    {
      kind: 'history',
      structuredSession: { sessionId: id, workspaceId: folderWorkspaceKey(bot.folderWorkspaceId) }
    },
    { present: () => undefined }
  ).catch(() => null)
  return result?.kind === 'opened' ? findChatTarget(result.tab.id) : null
}

/** Shows one of the bot's chats (its Home chat when `sessionId` is null) in a mirror. */
export async function mirrorBotChat(bot: Bot, sessionId: string | null): Promise<void> {
  const target = await resolveBotChatTarget(bot, sessionId)
  if (!target) {
    showChatOpenUnavailable()
    return
  }
  popOutAgentHubTab(target)
}

/** Switches a mirror tab to another of the bot's chats; the tab keeps its place and its home. */
export async function showBotChatInMirror(
  shown: AgentHubPaneTarget,
  bot: Bot,
  sessionId: string | null
): Promise<void> {
  const target = await resolveBotChatTarget(bot, sessionId)
  const owner = findAgentHubMirrorMembership(readAgentHubMirrors(), shown)
  if (!target || !owner) {
    showChatOpenUnavailable()
    return
  }
  selectAgentHubMirrorFamilyMember(owner.window.id, owner.tab.id, target)
}

/** The Orb's own window for the Orb bot's chat; the sidebar's Bots list for any other bot. */
export function showBotChatInOrbOrBots(
  target: AgentHubPaneTarget,
  botChat: { bot: Bot; isOrb: boolean; sessionId: string | null; origin: string }
): void {
  if (!botChat.isOrb) {
    revealAgentHubTargetInSidebar(target)
    return
  }
  const { bot, sessionId } = botChat
  const opened =
    botChat.origin === 'home' || !sessionId
      ? Promise.resolve(false)
      : openAgentHubOrbSideChat(bot, sessionId, target.title)
  void opened
    .then((handled) => (handled ? true : openAgentHubOrb()))
    .catch(() => showChatOpenUnavailable())
}
