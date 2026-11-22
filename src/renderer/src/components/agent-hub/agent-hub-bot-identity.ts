import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useBots, useBotsEnabled } from '@/lib/bot-catalog'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-app-store-with-host-statuses'
import { findBotByWorkspace } from '../bots/bot-workspace'
import { botOfFolders, selectFolderAncestors } from '../bots/use-worktree-bot'
import { useBotChatTree } from '../bots/use-bot-chat-tree'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import { isBotHomeTab } from '../../../../shared/bots/bot-home-tab'
import type { Bot } from '../../../../shared/bot-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { findAgentHubChatTab } from './agent-hub-chat-tabs'

export type AgentHubBotOrigin =
  | 'home'
  | 'github'
  | 'slack'
  | 'linear'
  | 'automation'
  | 'side'
  | 'worker'

export type AgentHubBotIdentity = { bot: Bot; origin: AgentHubBotOrigin }

/** Where a bot's pane lives: the workspace and the tab that shows it. */
export type AgentHubBotSubject = {
  worktree: Pick<Worktree, 'id' | 'hostId'>
  tab: { id: string }
}

const NO_FOLDERS: readonly FolderWorkspace[] = []

/** Hub surfaces show bot identity only when the hub and bots are both on. */
export function useAgentHubBotsActive(): boolean {
  const botsEnabled = useBotsEnabled()
  return useAppStore((s) => s.settings?.experimentalAgentHub === true) && botsEnabled
}

/**
 * The bot behind a hub thread, chat tab or mirror target, and where its work came from; null for
 * everything that is not a bot's. A bot's page is its home folder workspace, so its chats sit in it
 * and its workers sit in workspaces beneath it.
 */
export function useAgentHubBotIdentity(
  subject: AgentHubBotSubject | null | undefined
): AgentHubBotIdentity | null {
  const active = useAgentHubBotsActive()
  const bots = useBots(active)
  const worktreeId = subject?.worktree.id ?? null
  const hostId = subject?.worktree.hostId ?? LOCAL_EXECUTION_HOST_ID
  const homeBot = useMemo(
    () => (active ? findBotByWorkspace(bots, worktreeId, hostId) : null),
    [active, bots, worktreeId, hostId]
  )
  const tabId = subject?.tab.id ?? null
  const session = useAppStore((s) =>
    homeBot && tabId ? (findAgentHubChatTab(s, tabId)?.entityId ?? null) : null
  )
  const folders = useAppStoreWithHostStatuses((s, statuses) =>
    active && !homeBot && subject && bots.length > 0
      ? selectFolderAncestors(s, statuses, subject.worktree)
      : NO_FOLDERS
  )
  const workerBot = useMemo(() => botOfFolders(folders, bots), [folders, bots])
  const { chats } = useBotChatTree(homeBot)
  return useMemo(() => {
    if (!homeBot) {
      return workerBot ? { bot: workerBot, origin: 'worker' } : null
    }
    if (session && isBotHomeTab({ contentType: 'agent-session', entityId: session }, homeBot)) {
      return { bot: homeBot, origin: 'home' }
    }
    const chat = session
      ? chats.find((entry) => entry.chatId === session || entry.liveSessionId === session)
      : undefined
    return { bot: homeBot, origin: chat?.origin ?? 'side' }
  }, [homeBot, workerBot, session, chats])
}
