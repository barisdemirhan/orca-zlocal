import { useAppStore } from '@/store'
import { readRuntimeStatusesForView } from '@/store/slices/runtime-status/views/runtime-status-owner'
import { readBots, readBotsEnabled } from '@/lib/bot-catalog'
import { findBotByWorkspace } from '../bots/bot-workspace'
import { botOfFolders, selectFolderAncestors } from '../bots/use-worktree-bot'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host/execution-host'
import { findAgentHubChatTab } from './agent-hub-chat-tabs'
import {
  resolveAgentHubBotIdentity,
  type AgentHubBotIdentity,
  type AgentHubBotSubject
} from './agent-hub-bot-identity'

/**
 * agent-hub-bot-identity's hook, read once from the stores: for the alert step, which runs outside
 * render. Chats of a bot's home that are not its main one all read as side chats here.
 */
export function readAgentHubBotIdentity(subject: AgentHubBotSubject): AgentHubBotIdentity | null {
  const state = useAppStore.getState()
  if (state.settings?.experimentalAgentHub !== true || !readBotsEnabled()) {
    return null
  }
  const bots = readBots()
  const hostId = subject.worktree.hostId ?? LOCAL_EXECUTION_HOST_ID
  const homeBot = findBotByWorkspace(bots, subject.worktree.id, hostId)
  const session = homeBot ? (findAgentHubChatTab(state, subject.tab.id)?.entityId ?? null) : null
  const folders =
    !homeBot && bots.length > 0
      ? selectFolderAncestors(state, readRuntimeStatusesForView(useAppStore), subject.worktree)
      : []
  return resolveAgentHubBotIdentity({
    homeBot,
    workerBot: botOfFolders(folders, bots),
    session,
    chats: []
  })
}
