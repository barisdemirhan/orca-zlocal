import { orderBotChats, type BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'

export const BOTS_CHATS_SHOWN = 6
export const BOTS_WORKERS_SHOWN = 3
export const BOTS_AUTOMATIONS_SHOWN = 4

export type BotsMoreList = 'chats' | 'automations' | 'automationsOpen' | `workers:${string}`

export function botsMoreKey(botKey: string, list: BotsMoreList): string {
  return `${botKey}\u0000${list}`
}

export function botChatNeedsOwner(chat: BotChatTreeChat): boolean {
  return chat.live === 'needs-you' || chat.running.some((worker) => worker.state === 'needs-you')
}

/** Waiting-on-you chats first, then the tree's own order (Home, replying, newest, closed last). */
export function hubBotChats(chats: readonly BotChatTreeChat[]): BotChatTreeChat[] {
  const ordered = orderBotChats(chats)
  return [
    ...ordered.filter((chat) => !chat.closed && botChatNeedsOwner(chat)),
    ...ordered.filter((chat) => chat.closed || !botChatNeedsOwner(chat))
  ]
}

export function chatTitleMatches(chat: BotChatTreeChat, needle: string): boolean {
  return chat.title.toLowerCase().includes(needle)
}
