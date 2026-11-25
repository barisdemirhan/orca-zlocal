import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { BotChatLine } from '../bots/BotChatTreeGroup'
import { botChatNeedsOwner } from './agent-hub-bots-chats'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'

/** A chat's second line: the question in the ask colour when it waits, failures in destructive. */
export function AgentHubBotsChatLine({
  bot,
  chat
}: {
  bot: Bot
  chat: BotChatTreeChat
}): React.JSX.Element {
  const needs = botChatNeedsOwner(chat)
  const failed = !needs && chat.live === 'idle' && chat.failedTotal > 0
  return (
    <span
      className={cn(
        'block truncate text-2xs',
        needs && 'text-agent-question-text',
        failed && 'text-destructive',
        !needs && !failed && 'text-muted-foreground'
      )}
    >
      {chat.live === 'needs-you' ? (
        (chat.preview ?? translate('bots.chats.waiting', 'Waiting for you'))
      ) : failed ? (
        [
          translate('agentHub.bots.tab.chatFailed', '{{count}} failed', {
            count: chat.failedTotal
          }),
          chat.preview
        ]
          .filter(Boolean)
          .join(' · ')
      ) : (
        <BotChatLine bot={bot} chat={chat} folded={false} />
      )}
    </span>
  )
}
