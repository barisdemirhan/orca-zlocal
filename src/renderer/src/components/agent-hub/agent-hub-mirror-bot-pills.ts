import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'
import { botChatNeedsOwner } from './agent-hub-bots-chats'
import { agentHubMirrorBotChatName } from './agent-hub-mirror-bot-chat'

export type AgentHubMirrorBotPill = {
  id: string
  sessionId: string | null
  title: string
  active: boolean
  mark: 'ask' | 'work' | 'unread' | null
}

function pillMark(chat: BotChatTreeChat): AgentHubMirrorBotPill['mark'] {
  if (botChatNeedsOwner(chat)) {
    return 'ask'
  }
  if (chat.live === 'replying') {
    return 'work'
  }
  return chat.unread ? 'unread' : null
}

/** The bot's open chats: Home first, then the ones waiting on the owner, then the tree's own order. */
export function agentHubMirrorBotPills(
  chats: readonly BotChatTreeChat[],
  session: string | null
): AgentHubMirrorBotPill[] {
  const open = chats.filter((chat) => !chat.closed && !chat.run)
  const rank = (chat: BotChatTreeChat): number =>
    chat.origin === 'home' ? 0 : botChatNeedsOwner(chat) ? 1 : 2
  return open
    .map((chat, index) => ({ chat, index }))
    .sort((a, b) => rank(a.chat) - rank(b.chat) || a.index - b.index)
    .map(({ chat }) => ({
      id: chat.chatId,
      sessionId: chat.origin === 'home' ? null : chat.chatId,
      title: agentHubMirrorBotChatName(chat, chat.title),
      active: session !== null && (chat.chatId === session || chat.liveSessionId === session),
      mark: pillMark(chat)
    }))
}
