import { useShallow } from 'zustand/react/shallow'
import { agentHubBotMuteKey, agentHubSenderMuted } from './agent-hub-sender-mute'
import { useAppStore } from '@/store'
import {
  agentHubSurfaceSetting,
  type AgentHubBotAutomationAlerts
} from '../../../../shared/agent-hub-surface-settings'
import type { Bot } from '../../../../shared/bot-types'

export type AgentHubBotAlertSettings = {
  onAsk: boolean
  onResult: boolean
  onFailure: boolean
  onSuggestion: boolean
  automation: AgentHubBotAutomationAlerts
  sound: boolean
}

export type AgentHubBotAlertChoice = 'ask' | 'result' | 'failure'

export function useAgentHubBotAlertSettings(): AgentHubBotAlertSettings {
  return useAppStore(
    useShallow((s) => ({
      onAsk: agentHubSurfaceSetting(s.settings, 'agentHubBotAlertOnAsk'),
      onResult: agentHubSurfaceSetting(s.settings, 'agentHubBotAlertOnResult'),
      onFailure: agentHubSurfaceSetting(s.settings, 'agentHubBotAlertOnFailure'),
      onSuggestion: agentHubSurfaceSetting(s.settings, 'agentHubBotAlertOnSuggestion'),
      automation: agentHubSurfaceSetting(s.settings, 'agentHubBotAutomationAlerts'),
      sound: agentHubSurfaceSetting(s.settings, 'agentHubBotAlertSound')
    }))
  )
}

/** A bubble needs the hub's switch for its kind and the bot's own switch for the same news. */
export function agentHubBotAlertAllowed(
  bot: Pick<Bot, 'notifications'>,
  choice: AgentHubBotAlertChoice,
  settings: Pick<AgentHubBotAlertSettings, 'onAsk' | 'onResult' | 'onFailure'>
): boolean {
  switch (choice) {
    case 'ask':
      return settings.onAsk && bot.notifications.needsPermission
    case 'result':
      return settings.onResult && bot.notifications.taskComplete
    case 'failure':
      return settings.onFailure && bot.notifications.couldNotFinish
  }
}

export type AgentHubBotThreadStatus = 'ask' | 'done' | 'failed'

/**
 * What becomes of an agent alert that belongs to a bot: a bubble of the bot's, or nothing. A worker's
 * finish is the bot's own business, a visible home chat needs no bubble, and a paused or muted bot
 * stays quiet. The bot's switches decide, never the agent alert choices.
 */
export function botThreadAlertDecision(args: {
  bot: Pick<Bot, 'notifications' | 'paused' | 'hostId' | 'id'>
  origin: 'home' | 'side' | 'worker'
  status: AgentHubBotThreadStatus
  homeChatVisible: boolean
  settings: Pick<AgentHubBotAlertSettings, 'onAsk' | 'onResult' | 'onFailure'>
}): 'bubble' | 'drop' {
  const { bot, origin, status, homeChatVisible, settings } = args
  if (
    bot.paused ||
    agentHubSenderMuted(agentHubBotMuteKey(bot)) ||
    (origin === 'worker' && status === 'done')
  ) {
    return 'drop'
  }
  if (origin === 'home' && homeChatVisible) {
    return 'drop'
  }
  const choice = status === 'ask' ? 'ask' : status === 'done' ? 'result' : 'failure'
  return agentHubBotAlertAllowed(bot, choice, settings) ? 'bubble' : 'drop'
}

export function readAgentHubBotAlertSettings(): AgentHubBotAlertSettings {
  const settings = useAppStore.getState().settings
  return {
    onAsk: agentHubSurfaceSetting(settings, 'agentHubBotAlertOnAsk'),
    onResult: agentHubSurfaceSetting(settings, 'agentHubBotAlertOnResult'),
    onFailure: agentHubSurfaceSetting(settings, 'agentHubBotAlertOnFailure'),
    onSuggestion: agentHubSurfaceSetting(settings, 'agentHubBotAlertOnSuggestion'),
    automation: agentHubSurfaceSetting(settings, 'agentHubBotAutomationAlerts'),
    sound: agentHubSurfaceSetting(settings, 'agentHubBotAlertSound')
  }
}
