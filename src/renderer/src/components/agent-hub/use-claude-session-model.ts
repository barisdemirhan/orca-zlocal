import { useEffect, useState } from 'react'

// Claude's hooks do not report the model, but Orca's usage scan reads it from the transcripts.
const STALE_MS = 60_000
let modelBySession = new Map<string, string>()
let fetchedAt = 0
let inflight: Promise<void> | null = null

function refreshSessionModels(): Promise<void> {
  if (!inflight) {
    inflight = window.api.claudeUsage
      .getRecentSessions({ scope: 'all', range: '7d', limit: 200 })
      .then((sessions) => {
        modelBySession = new Map(
          sessions.flatMap((session) =>
            session.model ? [[session.sessionId, session.model] as const] : []
          )
        )
        fetchedAt = Date.now()
      })
      // A disabled or failing usage scan only means no model is shown.
      .catch(() => undefined)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** The model a Claude session runs, from the usage scan; null until known or when scanning is off. */
export function useClaudeSessionModel(sessionId: string | null): string | null {
  const [, refresh] = useState(0)
  useEffect(() => {
    if (!sessionId || Date.now() - fetchedAt < STALE_MS) {
      return
    }
    let live = true
    void refreshSessionModels().then(() => {
      if (live) {
        refresh((revision) => revision + 1)
      }
    })
    return () => {
      live = false
    }
  }, [sessionId])
  return sessionId ? (modelBySession.get(sessionId) ?? null) : null
}
