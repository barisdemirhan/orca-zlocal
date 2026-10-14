import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/structured-agent-session-status-feed'

export function useAgentHubOrbConversations(sessionId: string, history: boolean) {
  const [conversations, setConversations] = useState<AgentHubOrbConversation[]>([])
  const [error, setError] = useState(false)
  const generation = useRef(0)
  const invalidate = useCallback(() => {
    ++generation.current
  }, [])
  const refresh = useCallback(async () => {
    const issued = ++generation.current
    try {
      const next = await window.api.agentHub.orb.list()
      if (issued === generation.current) {
        setConversations(next)
        setError(false)
      }
    } catch {
      if (issued === generation.current) {
        setError(true)
      }
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [sessionId, history, refresh])
  useEffect(() => {
    const feed = getStructuredAgentSessionStatusFeed({ kind: 'local' })
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
  return { conversations, error, refresh }
}
