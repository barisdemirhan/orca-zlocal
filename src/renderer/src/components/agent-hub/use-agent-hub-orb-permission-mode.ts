import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import {
  isAgentChatPermissionMode,
  type AgentChatPermissionMode
} from '../../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import { agentHubOrbChosenMode } from '../../../../shared/agent-hub-orb-settings'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/structured-agent-session-status-feed'

const LOCAL_TARGET = { kind: 'local' } as const

/** The mode the Orb chat runs in: the host's live word first, else the saved Orb choice. */
export function useAgentHubOrbPermissionMode(sessionId: string): AgentChatPermissionMode | null {
  const feed = useMemo(() => getStructuredAgentSessionStatusFeed(LOCAL_TARGET), [])
  useEffect(() => feed.activate(), [feed])
  const subscribe = useCallback(
    (listener: () => void) => feed.subscribeSession(sessionId, listener),
    [feed, sessionId]
  )
  const live = useSyncExternalStore(
    subscribe,
    () => feed.getSnapshot().get(sessionId)?.permissionMode,
    () => undefined
  )
  const chosen = useAppStore((s) => s.settings?.agentHubOrbPermission)
  return isAgentChatPermissionMode(live) ? live : agentHubOrbChosenMode(chosen)
}
