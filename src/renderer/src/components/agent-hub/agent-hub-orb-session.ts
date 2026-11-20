import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { useNow } from '@/lib/window-activity/use-now'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import type { AgentHubOrbSession } from '../../../../shared/agent-hub-orb'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import { useStructuredAgentSessionRead } from '../native-chat/session/structured/read/use-structured-agent-session-read'
import { useStructuredAgentSessionTransportState } from '../native-chat/session/structured/use-structured-agent-session-transport-state'
import { useAgentHubDictationSession } from './agent-hub-dictation-origin'
import { agentHubInboxRequests, useAgentHubRequests } from './agent-hub-requests-store'
import {
  deriveAgentHubOrbState,
  AGENT_HUB_ORB_TARGET,
  agentHubOrbThread
} from './agent-hub-orb-state'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { agentHubOrbLaunchAction } from '../../../../shared/agent-hub-orb-settings'

export function useAgentHubOrb(threads: readonly AgentPaneThread[]) {
  const [session, setSession] = useState<AgentHubOrbSession | null>(null)
  const enabled = useAppStore((s) => s.settings?.agentHubAgentControl !== false)
  const tabs = useAppStore((s) => s.unifiedTabsByWorktree)
  const opening = useAgentHubOrbPanel((s) => s.opening)
  const generation = useRef(0)
  const invalidate = useCallback(() => {
    ++generation.current
  }, [])
  const refresh = useCallback(async () => {
    const issued = ++generation.current
    const panel = useAgentHubOrbPanel.getState().session
    try {
      const next = await window.api.agentHub.orb.current()
      if (issued === generation.current) {
        if (
          !useAgentHubOrbPanel.getState().opening &&
          panel &&
          panel === useAgentHubOrbPanel.getState().session &&
          panel.sessionId !== next?.sessionId
        ) {
          closeAgentHubOrbPanel()
        }
        setSession((current) =>
          current?.sessionId === next?.sessionId &&
          current?.tabId === next?.tabId &&
          current?.resumed === next?.resumed
            ? current
            : next
        )
      }
    } catch (error) {
      if (
        issued === generation.current &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'disabled'
      ) {
        setSession(null)
        if (panel && panel === useAgentHubOrbPanel.getState().session) {
          closeAgentHubOrbPanel()
        }
      }
    }
  }, [])
  useEffect(() => {
    if (!enabled) {
      invalidate()
      setSession(null)
      closeAgentHubOrbPanel()
      return
    }
    if (!opening) {
      void refresh()
    }
  }, [refresh, tabs, enabled, opening, invalidate])
  useEffect(() => {
    const feed = getStructuredAgentSessionStatusFeed(AGENT_HUB_ORB_TARGET)
    const stop = feed.activate()
    const unsubscribe = feed.subscribe(() => {
      void refresh()
    })
    return () => {
      invalidate()
      unsubscribe()
      stop()
    }
  }, [refresh, invalidate])
  const read = useStructuredAgentSessionRead({
    sessionId: session?.sessionId ?? '',
    target: AGENT_HUB_ORB_TARGET,
    isVisible: session !== null && enabled,
    isViewed: false
  })
  const native = useStructuredAgentSessionTransportState(read.state, session !== null && enabled)
  const requests = useAgentHubRequests()
  const dictation = useAgentHubDictationSession()
  const [now, setNow] = useState(Date.now)
  const currentTime = useNow(1000, session !== null && enabled)
  const thread = threads.find((entry) => agentHubOrbThread(entry, session?.tabId))
  const state = deriveAgentHubOrbState({
    sessionId: enabled ? (session?.sessionId ?? null) : null,
    items: native.journalItems,
    currentRequests: native.currentRequests,
    working: native.isWorking || native.queueSendsNext,
    latestTurn: native.latestTurn,
    listening: Boolean(session?.tabId && dictation?.pane?.tabId === session.tabId),
    requests: agentHubInboxRequests(requests),
    thread,
    now: Math.max(now, currentTime)
  })
  const expiresAt = state.kind === 'done' ? state.expiresAt : null
  useEffect(() => {
    if (expiresAt === null) {
      return undefined
    }
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [expiresAt])
  const openOrb = useCallback(
    async (alternate = false, activate = true) => {
      await openAgentHubOrb(
        undefined,
        false,
        activate ? agentHubOrbLaunchAction(useAppStore.getState().settings, alternate) : undefined
      )
      await refresh()
    },
    [refresh]
  )
  return { state, session, openOrb, readState: read.state }
}
