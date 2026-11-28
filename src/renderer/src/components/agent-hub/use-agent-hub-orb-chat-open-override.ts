import { useMemo } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { openBotSession } from '../bots/bot-session-open'
import { openChat } from '../bots/BotChatTreeGroup'
import { openAgentHubOrbWorkerChat } from './agent-hub-orb-worker-chat'
import { openOrchestrationWorker } from '@/lib/open-orchestration-worker'
import { botTarget } from '@/lib/bot-hosts'
import type { BotChatOpenOverride } from '../bots/bot-chat-open-override'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { useAppStore } from '@/store'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import { setAgentHubOrbWindowTab, useAgentHubOrbChatStrip } from './agent-hub-orb-chat-strip-store'
import {
  newAgentHubOrbSideChat,
  openAgentHubOrbSideChat,
  orbStripCanOpenAnother,
  showAgentHubOrbHomeChat
} from './agent-hub-orb-side-chat'

/** The Orb window's Chats tab opens its chats in the window's own strip instead of a main tab. */
export function useAgentHubOrbChatOpenOverride(clearHome: () => void): BotChatOpenOverride {
  const newChatAction = useAppStore((s) =>
    agentHubSurfaceSetting(s.settings, 'agentHubOrbNewChatAction')
  )
  const activeId = useAgentHubOrbChatStrip((s) => s.strip.activeId)
  return useMemo(
    () => ({
      isShown: (chat) =>
        activeId === AGENT_HUB_ORB_HOME_CHAT ? chat.origin === 'home' : chat.chatId === activeId,
      chat: (bot, chat) => {
        if (bot.role !== 'orb') {
          return false
        }
        setAgentHubOrbWindowTab('chat')
        if (chat.origin === 'home') {
          showAgentHubOrbHomeChat()
          return true
        }
        void openAgentHubOrbSideChat(
          bot,
          chat.chatId,
          chat.title || translate('agentHub.orb.strip.newChat', 'New chat')
        ).then((handled) => (handled ? undefined : openChat(bot, chat)))
        return true
      },
      session: (bot, sessionId, title) => {
        if (bot.role !== 'orb') {
          return false
        }
        setAgentHubOrbWindowTab('chat')
        if (sessionId === bot.chatSessionId) {
          showAgentHubOrbHomeChat()
          return true
        }
        void openAgentHubOrbSideChat(bot, sessionId, title).then((handled) =>
          handled ? undefined : openBotSession(bot, sessionId)
        )
        return true
      },
      worker: (bot, worker) => {
        if (bot.role !== 'orb' || !worker.dispatchId) {
          return false
        }
        const { dispatchId } = worker
        setAgentHubOrbWindowTab('chat')
        void openAgentHubOrbWorkerChat(bot, worker).then((handled) => {
          if (!handled) {
            openOrchestrationWorker(
              {
                dispatchId,
                title: worker.title,
                worktreeId: worker.worktreeId ?? null,
                chatSessionId: null,
                host: worker.host
              },
              botTarget(bot)
            )
          }
        })
        return true
      },
      newChat: (bot) => {
        if (bot.role !== 'orb') {
          return false
        }
        setAgentHubOrbWindowTab('chat')
        if (newChatAction === 'clear-home') {
          showAgentHubOrbHomeChat()
          clearHome()
        } else if (!orbStripCanOpenAnother()) {
          toast.message(
            translate(
              'agentHub.orb.strip.fullHint',
              'Every open chat is busy. Close one or wait for it to finish.'
            )
          )
        } else {
          void newAgentHubOrbSideChat(bot)
        }
        return true
      }
    }),
    [clearHome, newChatAction, activeId]
  )
}
