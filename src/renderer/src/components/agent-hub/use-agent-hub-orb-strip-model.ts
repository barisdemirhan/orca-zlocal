import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import type { Bot } from '../../../../shared/bot-types'
import { openBotSession } from '../bots/bot-session-open'
import type { AgentHubOrbStripTab } from './AgentHubOrbChatStrip'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import {
  renameAgentHubOrbStripChat,
  useAgentHubOrbChatStrip
} from './agent-hub-orb-chat-strip-store'
import {
  closeAgentHubOrbSideChat,
  newAgentHubOrbSideChat,
  orbStripCanOpenAnother,
  showAgentHubOrbStripChat
} from './agent-hub-orb-side-chat'
import { useAgentHubOrbChatStatuses } from './use-agent-hub-orb-chat-statuses'
import type { AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'
import { useAgentHubOrbWindowKeys } from './use-agent-hub-orb-window-keys'

export type AgentHubOrbStripModel = {
  tabs: AgentHubOrbStripTab[]
  activeId: string
  limit: number
  full: boolean
  liveElsewhere: boolean
  liveId: string | null
  liveTitle: string
  activate: (id: string) => void
  close: (id: string) => void
  newChat: () => void
  rename: (id: string, title: string) => void
  openAsTab: (id: string) => void
}

/** One model of the open chats for the full window's strip and the mini window's. */
export function useAgentHubOrbStripModel({
  bot,
  sessionId,
  homeTitle,
  voice,
  onClearHome
}: {
  bot: Bot
  sessionId: string
  homeTitle: string
  voice: AgentHubOrbVoiceValue
  onClearHome: () => void
}): AgentHubOrbStripModel {
  const strip = useAgentHubOrbChatStrip((s) => s.strip)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const liveId = useAgentHubOrbChatStrip((s) => s.liveId)
  const limit = useAppStore((s) => agentHubSurfaceSetting(s.settings, 'agentHubOrbOpenChatsLimit'))
  const keepLive = useAppStore((s) =>
    agentHubSurfaceSetting(s.settings, 'agentHubOrbKeepLiveOnSwitch')
  )
  const ids = useMemo(() => strip.chats.map((chat) => chat.id), [strip.chats])
  const statuses = useAgentHubOrbChatStatuses(ids, sessionId)
  const live = voice.connection === 'connecting' || voice.connection === 'live'
  const tabs = useMemo<AgentHubOrbStripTab[]>(
    () =>
      ids.map((id) => ({
        id,
        title: id === AGENT_HUB_ORB_HOME_CHAT ? homeTitle : (meta[id]?.title ?? ''),
        status: statuses.get(id) ?? 'idle',
        live: live && (liveId ?? strip.activeId) === id,
        ...(meta[id]?.worker ? { readOnly: true, agent: meta[id].worker.agent } : {})
      })),
    [ids, meta, homeTitle, statuses, live, liveId, strip.activeId]
  )
  const activate = useCallback(
    (id: string) => {
      if (live && !keepLive) {
        void voice.stopLive()
      }
      showAgentHubOrbStripChat(id)
    },
    [live, keepLive, voice]
  )
  const close = useCallback(
    (id: string) => {
      if (live && liveId === id) {
        void voice.stopLive()
      }
      closeAgentHubOrbSideChat(id)
    },
    [live, liveId, voice]
  )
  const clearHomeAction = useAppStore(
    (s) => agentHubSurfaceSetting(s.settings, 'agentHubOrbNewChatAction') === 'clear-home'
  )
  const newChat = useCallback(() => {
    if (clearHomeAction) {
      showAgentHubOrbStripChat(AGENT_HUB_ORB_HOME_CHAT)
      onClearHome()
      return
    }
    if (!orbStripCanOpenAnother()) {
      toast.message(
        translate(
          'agentHub.orb.strip.fullHint',
          'Every open chat is busy. Close one or wait for it to finish.'
        )
      )
      return
    }
    void newAgentHubOrbSideChat(bot)
  }, [bot, clearHomeAction, onClearHome])
  useAgentHubOrbWindowKeys({ ids, activate, close, newChat })
  const openAsTab = useCallback(
    (id: string) => {
      close(id)
      openBotSession(bot, id)
    },
    [bot, close]
  )
  return {
    tabs,
    activeId: strip.activeId,
    limit,
    full: strip.chats.length >= limit && !orbStripCanOpenAnother(),
    liveElsewhere: live && keepLive && liveId !== null && liveId !== strip.activeId,
    liveId,
    liveTitle: tabs.find((entry) => entry.id === liveId)?.title ?? homeTitle,
    activate,
    close,
    newChat,
    rename: renameAgentHubOrbStripChat,
    openAsTab
  }
}
