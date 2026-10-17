import { useLayoutEffect, useState } from 'react'
import type { AgentHubInboxRequest } from './agent-hub-requests-store'

const NO_REQUESTS: ReadonlySet<string> = new Set()

export function useAgentHubOrbSessionRequests(
  scope: string,
  pendingIds: readonly string[],
  active: boolean
): ReadonlySet<string> {
  const [seen, setSeen] = useState(() => ({
    scope,
    ids: new Set(active ? pendingIds : [])
  }))
  useLayoutEffect(() => {
    setSeen((current) => {
      const ids = new Set(active && current.scope === scope ? current.ids : [])
      if (active) {
        for (const id of pendingIds) {
          ids.add(id)
        }
      }
      return current.scope === scope &&
        ids.size === current.ids.size &&
        [...ids].every((id) => current.ids.has(id))
        ? current
        : { scope, ids }
    })
  }, [active, pendingIds, scope])
  return active && seen.scope === scope ? seen.ids : NO_REQUESTS
}

export function agentHubCurrentOrbRequest(
  item: AgentHubInboxRequest,
  owner: { host: string; sessionId: string } | null
): boolean {
  return (
    owner !== null &&
    item.host === owner.host &&
    item.request.caller.kind === 'orb' &&
    item.request.caller.sessionId === owner.sessionId
  )
}
