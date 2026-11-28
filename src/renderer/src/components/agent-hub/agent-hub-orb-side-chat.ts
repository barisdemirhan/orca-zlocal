import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { startBotSession } from '@/lib/bot-catalog'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { refreshLocalStructuredSessionTabs } from '@/runtime/local-structured-session-tabs-sync/inventory-refresh'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/workspace-mounting/background-terminal-worktree-mount'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { Bot } from '../../../../shared/bot-types'
import { AGENT_HUB_ORB_HOME_CHAT, type OrbStripChatStatus } from './agent-hub-orb-chat-strip'
import {
  activateAgentHubOrbStripChat,
  closeAgentHubOrbStripChat,
  openAgentHubOrbStripChat,
  useAgentHubOrbChatStrip
} from './agent-hub-orb-chat-strip-store'
import { orbShownTabIdFor } from './agent-hub-orb-main-tab'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { sendAgentHubOrbTextWhenReady } from './agent-hub-orb-composer'

export const AGENT_HUB_ORB_NEW_TARGET = 'new'

export function orbStripChatStatus(id: string): OrbStripChatStatus {
  const sessionId =
    id === AGENT_HUB_ORB_HOME_CHAT ? useAgentHubOrbPanel.getState().session?.sessionId : id
  return (
    (sessionId &&
      getStructuredAgentSessionStatusFeed({ kind: 'local' }).getSnapshot().get(sessionId)
        ?.status) ||
    'idle'
  )
}

/** Shows a chat in the Orb window from any workspace; the chat's tab is mounted without activating it. */
async function resolveTab(bot: Bot, sessionId: string): Promise<string | null> {
  const where = {
    workspaceId: folderWorkspaceKey(bot.folderWorkspaceId),
    sessionId,
    target: { kind: 'local' as const }
  }
  let tab = findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, where)
  if (!tab) {
    await refreshLocalStructuredSessionTabs()
    tab = findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, where)
  }
  if (!tab) {
    return null
  }
  requestBackgroundTerminalWorktreeMount({ worktreeId: where.workspaceId, tabIds: [tab.id] })
  return tab.id
}

/** False when the strip is full and every other chat is working or asking, so a new one has no room. */
export function orbStripCanOpenAnother(): boolean {
  const { strip } = useAgentHubOrbChatStrip.getState()
  const limit = agentHubSurfaceSetting(useAppStore.getState().settings, 'agentHubOrbOpenChatsLimit')
  return (
    strip.chats.length < limit ||
    strip.chats.some(
      (chat) => chat.id !== AGENT_HUB_ORB_HOME_CHAT && orbStripChatStatus(chat.id) === 'idle'
    )
  )
}

export function showAgentHubOrbHomeChat(): void {
  activateAgentHubOrbStripChat(AGENT_HUB_ORB_HOME_CHAT)
  useAgentHubOrbPanel.setState({ shownTabId: null })
}

export function showAgentHubOrbStripChat(sessionId: string): void {
  if (sessionId === AGENT_HUB_ORB_HOME_CHAT) {
    showAgentHubOrbHomeChat()
    return
  }
  const meta = useAgentHubOrbChatStrip.getState().meta[sessionId]
  if (!meta) {
    return
  }
  activateAgentHubOrbStripChat(sessionId)
  useAgentHubOrbPanel.setState({ shownTabId: orbShownTabIdFor(meta.tabId) })
}

/** Returns false when the bot is not local (the default open then applies) or no room could be made. */
export async function openAgentHubOrbSideChat(
  bot: Bot,
  sessionId: string,
  title: string
): Promise<boolean> {
  if (bot.hostId !== LOCAL_EXECUTION_HOST_ID) {
    return false
  }
  const tabId = await resolveTab(bot, sessionId)
  if (!tabId) {
    return false
  }
  const limit = agentHubSurfaceSetting(useAppStore.getState().settings, 'agentHubOrbOpenChatsLimit')
  if (!openAgentHubOrbStripChat(sessionId, limit, orbStripChatStatus, tabId, title)) {
    toast.message(
      translate(
        'agentHub.orb.strip.fullHint',
        'Every open chat is busy. Close one or wait for it to finish.'
      )
    )
    return true
  }
  useAgentHubOrbPanel.setState({ shownTabId: orbShownTabIdFor(tabId) })
  return true
}

/** The new chat's session id, or null when it could not start or has no room in the strip. */
export async function newAgentHubOrbSideChat(bot: Bot): Promise<string | null> {
  try {
    const sessionId = await startBotSession(bot, { agent: bot.agent })
    const handled = await openAgentHubOrbSideChat(
      bot,
      sessionId,
      translate('agentHub.orb.strip.newChat', 'New chat')
    )
    return handled && useAgentHubOrbChatStrip.getState().meta[sessionId] ? sessionId : null
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
    return null
  }
}

/** The quick input's target: "new" starts a side chat; an open side chat is shown so its composer takes the line. */
export async function sendAgentHubOrbTextToStripChat(
  target: string,
  bot: Bot | null,
  text: string
): Promise<boolean> {
  let id = target
  if (target === AGENT_HUB_ORB_NEW_TARGET) {
    if (!bot || !orbStripCanOpenAnother()) {
      return false
    }
    const created = await newAgentHubOrbSideChat(bot)
    if (!created) {
      return false
    }
    id = created
  } else {
    showAgentHubOrbStripChat(id)
  }
  const tabId = useAgentHubOrbChatStrip.getState().meta[id]?.tabId
  return tabId ? sendAgentHubOrbTextWhenReady(tabId, text) : false
}

export function closeAgentHubOrbSideChat(sessionId: string): void {
  const wasShown = useAgentHubOrbChatStrip.getState().strip.activeId === sessionId
  closeAgentHubOrbStripChat(sessionId)
  if (wasShown) {
    showAgentHubOrbStripChat(useAgentHubOrbChatStrip.getState().strip.activeId)
  }
}

/** Brings the Orb window up on a side chat, from the sphere or its ask card. */
export function openAgentHubOrbSideAskChat(sessionId: string): void {
  useAgentHubOrbPanel.setState({ presentation: 'chat', compact: false })
  useAgentHubOrbChatStrip.setState({ windowTab: 'chat' })
  showAgentHubOrbStripChat(sessionId)
}
