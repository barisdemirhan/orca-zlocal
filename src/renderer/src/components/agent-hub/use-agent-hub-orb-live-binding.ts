import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import { agentHubSurfaceSetting } from '../../../../shared/agent-hub-surface-settings'
import { AGENT_HUB_ORB_HOME_CHAT } from './agent-hub-orb-chat-strip'
import {
  clearAgentHubOrbLiveRestart,
  moveAgentHubOrbLiveTo,
  useAgentHubOrbChatStrip
} from './agent-hub-orb-chat-strip-store'
import { useAgentHubOrbVoice, type AgentHubOrbVoiceValue } from './use-agent-hub-orb-voice'

/**
 * The Orb's voice follows the shown chat until Live starts, then stays on the chat it started in
 * (when "keep Live on switch" is on). The sphere's state never depends on mic or speaker being off.
 */
export function useAgentHubOrbLiveBinding(
  session: AgentHubOrbSession | null,
  visible: boolean
): AgentHubOrbVoiceValue {
  const keepLive = useAppStore((s) =>
    agentHubSurfaceSetting(s.settings, 'agentHubOrbKeepLiveOnSwitch')
  )
  const activeId = useAgentHubOrbChatStrip((s) => s.strip.activeId)
  const liveId = useAgentHubOrbChatStrip((s) => s.liveId)
  const meta = useAgentHubOrbChatStrip((s) => s.meta)
  const restartLive = useAgentHubOrbChatStrip((s) => s.restartLive)
  const boundId = keepLive ? (liveId ?? activeId) : activeId
  const voiceSession = useMemo<AgentHubOrbSession | null>(() => {
    const side = boundId === AGENT_HUB_ORB_HOME_CHAT ? undefined : meta[boundId]
    return session && side
      ? { sessionId: boundId, tabId: side.tabId, resumed: true, workspaceId: session.workspaceId }
      : session
  }, [session, boundId, meta])
  const voice = useAgentHubOrbVoice(voiceSession, visible)
  const live = voice.connection === 'connecting' || voice.connection === 'live'
  const idle = !live && voice.connection !== 'stopping'
  useEffect(() => {
    if (live && liveId === null) {
      moveAgentHubOrbLiveTo(boundId)
    } else if (idle && liveId !== null) {
      moveAgentHubOrbLiveTo(null)
    }
  }, [live, idle, liveId, boundId])
  // Why: "Move Live here" stopped Live on the old chat; this voice is now bound to the shown chat.
  useEffect(() => {
    if (restartLive && liveId === null && idle) {
      clearAgentHubOrbLiveRestart()
      void voice.startLive()
    }
  }, [restartLive, liveId, idle, voice])
  return voice
}
