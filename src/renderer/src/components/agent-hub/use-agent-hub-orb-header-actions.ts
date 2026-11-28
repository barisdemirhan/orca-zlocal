import { useCallback } from 'react'
import { openBotSettings } from '../bots/bot-settings-open'
import type { Bot } from '../../../../shared/bot-types'
import { useAgentHubOrbChatOpenOverride } from './use-agent-hub-orb-chat-open-override'
import { openBotPage } from './agent-hub-bot-page-open'

/** The header's "+" and the ⋯ menu's page links, shared by the full and the mini window. */
export function useAgentHubOrbHeaderActions({
  bot,
  clearHome,
  fallbackNew
}: {
  bot: Bot | null
  clearHome: () => void
  fallbackNew: () => void
}): { onNew: () => void; onOpenPage: () => void; onBotSettings: () => void } {
  const override = useAgentHubOrbChatOpenOverride(clearHome)
  const onNew = useCallback(() => {
    if (!bot || !override.newChat?.(bot)) {
      fallbackNew()
    }
  }, [bot, override, fallbackNew])
  const onOpenPage = useCallback(() => {
    if (bot) {
      void openBotPage(bot)
    }
  }, [bot])
  const onBotSettings = useCallback(() => {
    if (bot) {
      openBotSettings(bot.id)
    }
  }, [bot])
  return { onNew, onOpenPage, onBotSettings }
}
