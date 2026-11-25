import { toast } from 'sonner'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { startBotSession } from '@/lib/bot-catalog'
import { useAppStore } from '@/store'
import { botErrorMessage } from '../bots/bot-presentation'
import { structuredAgentSessionStatusPaneKey } from '../../../../shared/agent-session/view/structured-agent-session-tab'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'

/** A new side chat on the bot's own agent, opened in its tab. */
export function startBotSideChat(bot: Bot): void {
  void startBotSession(bot, { agent: bot.agent })
    .then((sessionId) =>
      activateAiVaultStructuredSession({
        structuredSession: { workspaceId: folderWorkspaceKey(bot.folderWorkspaceId), sessionId }
      })
    )
    .catch((error: unknown) => toast.error(botErrorMessage(error)))
}

export function markBotChatRead(chat: BotChatTreeChat): void {
  const paneKey = chat.turnDone?.paneKey ?? structuredAgentSessionStatusPaneKey(chat.chatId)
  useAppStore.getState().acknowledgeAgents([paneKey], undefined, 'explicit')
}
