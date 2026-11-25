import { createContext } from 'react'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat, BotChatTreeWorker } from '../../../../shared/bots/bot-chat-tree'

/** A host (the Orb window) can take a chat open or a new chat itself; a handled call skips the default. */
export type BotChatOpenOverride = {
  chat?: (bot: Bot, chat: BotChatTreeChat) => boolean
  /** A worker row; a handled call skips the default open. */
  worker?: (bot: Bot, worker: BotChatTreeWorker) => boolean
  /** A chat named by session id (a needs row); a handled call skips the default open. */
  session?: (bot: Bot, sessionId: string, title: string) => boolean
  newChat?: (bot: Bot) => boolean
  /** The chat the host shows now; its row is marked. */
  isShown?: (chat: BotChatTreeChat) => boolean
}

export const BotChatOpenOverrideContext = createContext<BotChatOpenOverride | null>(null)
