import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { botAgentLabel } from '../bots/bot-presentation'
import type { Bot } from '../../../../shared/bot-types'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { findAgentHubChatTab } from './agent-hub-chat-tabs'
import { agentHubStateWord } from './agent-hub-copy'
import { useAgentHubBotIdentity, type AgentHubBotOrigin } from './agent-hub-bot-identity'
import { shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { useAgentHubMirrors } from './agent-hub-mirror-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export type AgentHubMirrorBotChat = {
  bot: Bot
  origin: Exclude<AgentHubBotOrigin, 'worker'>
  isOrb: boolean
  /** The chat session this pane shows. */
  sessionId: string | null
}

/**
 * The bot whose chat a mirror pane shows (its Home chat or any side chat); null for agents,
 * terminals and a bot's workers. One reading for the tab, the card, the footer and the hover card.
 */
export function useAgentHubMirrorBotChat(
  target: AgentHubPaneTarget | null
): AgentHubMirrorBotChat | null {
  const identity = useAgentHubBotIdentity(target)
  const chat = useAppStore((s) => (target ? findAgentHubChatTab(s, target.tab.id) : null))
  return useMemo(
    () =>
      identity && chat && identity.origin !== 'worker'
        ? {
            bot: identity.bot,
            origin: identity.origin,
            isOrb: identity.bot.role === 'orb',
            sessionId: chat.entityId
          }
        : null,
    [identity, chat]
  )
}

/** The same for a chat's composer, which knows only its tab: set once a mirror window shows that tab. */
export function useAgentHubMirroredBotChatOfTab(
  tabId: string
): { target: AgentHubPaneTarget; botChat: AgentHubMirrorBotChat } | null {
  const mirrors = useAgentHubMirrors()
  const target = useMemo(() => {
    for (const window of mirrors.windows) {
      for (const tab of window.tabs) {
        const shown = shownAgentHubMirrorTarget(tab)
        if (shown.tab.id === tabId) {
          return shown
        }
      }
    }
    return null
  }, [mirrors, tabId])
  const botChat = useAgentHubMirrorBotChat(target)
  return target && botChat ? { target, botChat } : null
}

/** "Home chat" for the Home chat, else the chat's own name. */
export function agentHubMirrorBotChatName(
  botChat: Pick<AgentHubMirrorBotChat, 'origin'>,
  title: string
): string {
  return botChat.origin === 'home' ? translate('agentHub.bots.origin.home', 'Home chat') : title
}

/** The provider and model the chat runs on, and its state word. */
export function agentHubMirrorBotRuns(
  bot: Bot,
  thread: AgentPaneThread | null
): { provider: string; model: string | null; state: string } {
  const entry = thread?.paneEntry ?? thread?.currentAgentEntry
  return {
    provider: botAgentLabel(bot.agent),
    model: entry?.model?.trim() || bot.launch?.model || null,
    state: agentHubStateWord(thread)
  }
}
