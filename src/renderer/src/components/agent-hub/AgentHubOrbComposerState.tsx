import { createContext, useMemo, type ReactNode } from 'react'
import { useNow } from '@/lib/window-activity/use-now'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionLatestTurn } from '../../../../shared/agent-session/agent-session-wire'
import { agentHubInboxRequests, useAgentHubRequests } from './agent-hub-requests-store'
import { deriveAgentHubOrbState, type AgentHubOrbState } from './agent-hub-orb-state'

export const AgentHubOrbComposerStateContext = createContext<AgentHubOrbState>({ kind: 'idle' })

export function AgentHubOrbComposerState({
  enabled,
  sessionId,
  items,
  prompts,
  working,
  latestTurn,
  children
}: {
  enabled: boolean
  sessionId: string
  items: readonly AgentJournalRenderItem[]
  prompts: readonly AgentJournalRenderItem[]
  working: boolean
  latestTurn: AgentSessionLatestTurn | null | undefined
  children: ReactNode
}): React.JSX.Element {
  const requests = useAgentHubRequests()
  const now = useNow(1000, enabled)
  const state = useMemo(
    () =>
      deriveAgentHubOrbState({
        sessionId: enabled ? sessionId : null,
        items,
        currentRequests: prompts,
        working,
        listening: false,
        latestTurn,
        requests: agentHubInboxRequests(requests),
        now
      }),
    [enabled, sessionId, items, prompts, working, latestTurn, requests, now]
  )
  return <AgentHubOrbComposerStateContext value={state}>{children}</AgentHubOrbComposerStateContext>
}
