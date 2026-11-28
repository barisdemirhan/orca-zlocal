import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'
import { AGENT_HUB_ORB_HOME_CHAT, type OrbStripChatStatus } from './agent-hub-orb-chat-strip'

const feed = (): ReturnType<typeof getStructuredAgentSessionStatusFeed> =>
  getStructuredAgentSessionStatusFeed({ kind: 'local' })

/** Working, asking or idle for each strip chat; `home` reads the Orb session's own status. */
export function useAgentHubOrbChatStatuses(
  ids: readonly string[],
  homeSessionId: string | null
): ReadonlyMap<string, OrbStripChatStatus> {
  useEffect(() => feed().activate(), [])
  const key = useSyncExternalStore(
    (listener) => feed().subscribe(listener),
    () =>
      ids
        .map((id) => {
          const sessionId = id === AGENT_HUB_ORB_HOME_CHAT ? homeSessionId : id
          return `${id}=${(sessionId && feed().getSnapshot().get(sessionId)?.status) || 'idle'}`
        })
        .join(','),
    () => ''
  )
  return useMemo(
    () =>
      new Map(
        key
          .split(',')
          .filter(Boolean)
          .map((pair) => {
            const at = pair.lastIndexOf('=')
            return [pair.slice(0, at), pair.slice(at + 1) as OrbStripChatStatus] as const
          })
      ),
    [key]
  )
}
