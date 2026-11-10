import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentHubOrbConversation } from '../../../../shared/agent-hub-orb'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/native-chat/status/structured-agent-session-status-feed'

export function useAgentHubOrbConversations(sessionId: string, history: boolean) {
  const [conversations, setConversations] = useState<AgentHubOrbConversation[]>([])
  const [error, setError] = useState(false)
  const generation = useRef(0)
  const conversationIds = useRef(new Set<string>())
  const invalidate = useCallback(() => {
    ++generation.current
  }, [])
  const refresh = useCallback(async () => {
    const issued = ++generation.current
    try {
      const next = await window.api.agentHub.orb.list()
      if (issued === generation.current) {
        conversationIds.current = new Set(next.map((conversation) => conversation.sessionId))
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
  const [changes, setChanges] = useState(0)
  useEffect(() => {
    const feed = getStructuredAgentSessionStatusFeed({ kind: 'local' })
    let snapshot = feed.getSnapshot()
    const stop = feed.activate()
    const unsubscribe = feed.subscribe(() => {
      const next = feed.getSnapshot()
      const relevant = new Set([sessionId, ...conversationIds.current])
      const changed = [...relevant].some((id) => next.get(id) !== snapshot.get(id))
      snapshot = next
      if (changed) {
        setChanges((count) => count + 1)
      }
    })
    return () => {
      invalidate()
      unsubscribe()
      stop()
    }
  }, [sessionId, invalidate])
  useEffect(() => {
    if (changes === 0) {
      return
    }
    // Status bursts settle into one list read.
    const timer = setTimeout(() => {
      void refresh()
    }, 250)
    return () => clearTimeout(timer)
  }, [changes, refresh])
  return { conversations, error, refresh }
}
