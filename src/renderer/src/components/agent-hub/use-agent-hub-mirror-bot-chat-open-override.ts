import { useMemo } from 'react'
import type { BotChatOpenOverride } from '../bots/bot-chat-open-override'
import {
  newBotChatInMirror,
  showBotChatInMirror,
  showWorkerPaneInMirror
} from './agent-hub-bot-mirror'
import type { AgentHubMirrorBotChat } from './agent-hub-mirror-bot-chat'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

/** The bot's Chats tab in a mirror shows a chat, or a worker's pane, in the mirror tab itself. */
export function useAgentHubMirrorBotChatOpenOverride(
  target: AgentHubPaneTarget,
  botChat: AgentHubMirrorBotChat
): BotChatOpenOverride {
  const { sessionId } = botChat
  return useMemo(
    () => ({
      isShown: (chat) =>
        sessionId !== null && (chat.chatId === sessionId || chat.liveSessionId === sessionId),
      chat: (bot, chat) => {
        void showBotChatInMirror(target, bot, chat.origin === 'home' ? null : chat.chatId)
        return true
      },
      session: (bot, id) => {
        void showBotChatInMirror(target, bot, id)
        return true
      },
      worker: (_bot, worker) => showWorkerPaneInMirror(target, worker.paneKey),
      newChat: (bot) => {
        void newBotChatInMirror(target, bot)
        return true
      }
    }),
    [target, sessionId]
  )
}
