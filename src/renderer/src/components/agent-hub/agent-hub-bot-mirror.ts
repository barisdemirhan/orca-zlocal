import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { openBotChat, startBotSession } from '@/lib/bot-catalog'
import { botErrorMessage } from '../bots/bot-presentation'
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

function findPaneTarget(
  matches: (target: AgentHubPaneTarget) => boolean
): AgentHubPaneTarget | null {
  const find = (rows: readonly AgentHubTerminalRow[]): AgentHubPaneTarget | null => {
    for (const row of rows) {
      const target = paneTargetFromTerminalRow(row)
      if (matches(target)) {
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

function findChatTarget(tabId: string): AgentHubPaneTarget | null {
  return findPaneTarget((target) => target.tab.id === tabId)
}

/** The hub's pane target for a worker's pane key; null when no pane of that key is open. */
export function findAgentHubPaneTargetByPaneKey(paneKey: string): AgentHubPaneTarget | null {
  return findPaneTarget((target) => target.paneKey === paneKey)
}

/** Shows a worker's pane in the mirror tab; false when it has no pane open, which is told to the owner. */
export function showWorkerPaneInMirror(
  shown: AgentHubPaneTarget,
  paneKey: string | undefined
): boolean {
  const target = paneKey ? findAgentHubPaneTargetByPaneKey(paneKey) : null
  const owner = findAgentHubMirrorMembership(readAgentHubMirrors(), shown)
  if (!target || !owner) {
    toast.message(
      translate(
        'agentHub.mirror.bot.workerNoPane',
        'This worker has no open pane, so it opens in the main window.'
      )
    )
    return false
  }
  selectAgentHubMirrorFamilyMember(owner.window.id, owner.tab.id, target)
  return true
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

/** Starts a chat with the bot and shows it in the mirror tab. */
export async function newBotChatInMirror(shown: AgentHubPaneTarget, bot: Bot): Promise<void> {
  try {
    await showBotChatInMirror(shown, bot, await startBotSession(bot, { agent: bot.agent }))
  } catch (error) {
    toast.error(botErrorMessage(error))
  }
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
