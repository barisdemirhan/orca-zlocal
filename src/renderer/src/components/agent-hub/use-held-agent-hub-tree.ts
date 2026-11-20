import { useEffect, useMemo, useState } from 'react'
import type { AgentHubGroupNode } from './agent-hub-terminal-tree'
import {
  agentHubTreePlaces,
  holdAgentHubTreePlaces,
  sameAgentHubTreePlaces,
  type AgentHubTreePlaces
} from './agent-hub-tree-order-hold'

// The sidebar waits this long before re-ranking, so rows do not jump while being read or aimed at.
const SETTLE_MS = 3000

/**
 * The sorted tree, with re-ordering held back a moment: states update live, places follow once
 * the order has been quiet for a few seconds. A change of `resetKey` (another tab, sort or
 * filter) is the user's own doing and takes effect at once.
 */
export function useHeldAgentHubTree(
  sorted: readonly AgentHubGroupNode[],
  resetKey: string
): readonly AgentHubGroupNode[] {
  const fresh = useMemo(() => agentHubTreePlaces(sorted), [sorted])
  const [held, setHeld] = useState<{ key: string; places: AgentHubTreePlaces }>(() => ({
    key: resetKey,
    places: fresh
  }))
  if (held.key !== resetKey) {
    setHeld({ key: resetKey, places: fresh })
  }
  const settled = held.key === resetKey && sameAgentHubTreePlaces(held.places, fresh)
  useEffect(() => {
    if (settled) {
      return
    }
    const timer = setTimeout(() => setHeld({ key: resetKey, places: fresh }), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [settled, fresh, resetKey])
  return useMemo(
    () => (settled ? sorted : holdAgentHubTreePlaces(sorted, held.places)),
    [settled, sorted, held.places]
  )
}
