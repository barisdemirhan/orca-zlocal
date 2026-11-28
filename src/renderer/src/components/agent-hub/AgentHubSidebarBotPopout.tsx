import { useAppStore } from '@/store'
import type { Bot } from '../../../../shared/bot-types'
import type { BotChatTreeChat } from '../../../../shared/bots/bot-chat-tree'
import { mirrorBotChat } from './agent-hub-bot-mirror'
import { AgentHubPopOutButton } from './AgentHubPopOutButton'

const BOT_ROW_REVEAL =
  'shrink-0 self-center can-hover:opacity-0 group-hover/bot-row:opacity-100 group-focus-within/bot-row:opacity-100 focus-within:opacity-100'
// The row's ⋯ reveal; `data-chat-menu` hides the row's end text while this has focus, as the ⋯ does.
const BOT_CHAT_REVEAL = 'flex opacity-0 group-hover/bot-chat:opacity-100 focus-within:opacity-100'

function useAgentHubEnabled(): boolean {
  return useAppStore((s) => s.settings?.experimentalAgentHub === true)
}

/** The sidebar bot row's Pop out: its Home chat in a mirror. */
export function AgentHubBotRowPopout({
  bot,
  offline
}: {
  bot: Bot
  offline: boolean
}): React.JSX.Element | null {
  const enabled = useAgentHubEnabled()
  if (!enabled || offline) {
    return null
  }
  return (
    <AgentHubPopOutButton
      revealClassName={BOT_ROW_REVEAL}
      variant="ghost-on-accent"
      onPopOut={() => void mirrorBotChat(bot, null)}
    />
  )
}

/** A sidebar bot chat row's Pop out, beside its ⋯; a terminal-only run has neither. */
export function useAgentHubBotChatPopout(
  bot: Bot,
  chat: BotChatTreeChat,
  foldable: boolean
): {
  withMenu: (menu: React.ReactNode) => React.ReactNode
  /** Room at the row's end for both buttons on hover, left of its chevron. */
  endClassName: string | undefined
} {
  const enabled = useAgentHubEnabled()
  if (!enabled || chat.run) {
    return { withMenu: (menu) => menu, endClassName: undefined }
  }
  // The hub's Bots tab mirrors the same session: a /clear moves a chat past its first id.
  const sessionId = chat.origin === 'home' ? null : (chat.liveSessionId ?? chat.chatId)
  return {
    withMenu: (menu) => (
      <span className="flex items-center gap-1">
        <span data-chat-menu="" className="flex">
          <AgentHubPopOutButton
            revealClassName={BOT_CHAT_REVEAL}
            variant="ghost-on-accent"
            onPopOut={() => void mirrorBotChat(bot, sessionId)}
          />
        </span>
        {menu}
      </span>
    ),
    endClassName: foldable ? 'min-w-18' : 'min-w-13'
  }
}
