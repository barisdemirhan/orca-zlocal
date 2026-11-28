import { useEffect, useMemo, useState } from 'react'
import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'
import {
  AGENT_HUB_APPROVAL_GRACE_MS,
  buildAgentHubLists,
  type AgentHubLists
} from './agent-hub-lists'

/** The hub's sections, re-read the moment a lingering approval's grace period runs out. */
export function useAgentHubLists(
  threads: readonly AgentPaneThread[],
  now: number,
  finishedMaxAgeMs: number,
  lineage: AgentHubLineage
): AgentHubLists {
  const [graceClock, setGraceClock] = useState(() => Date.now())
  const lists = useMemo(
    () =>
      buildAgentHubLists(threads, {
        now: Math.max(now, graceClock),
        finishedMaxAgeMs,
        parentOf: lineage.parentOf,
        approvalGraceMs: AGENT_HUB_APPROVAL_GRACE_MS
      }),
    [threads, now, graceClock, finishedMaxAgeMs, lineage]
  )
  const graceEndsAt = lists.approvalGraceEndsAt
  useEffect(() => {
    if (graceEndsAt === null) {
      return
    }
    const timer = setTimeout(
      () => setGraceClock(Date.now()),
      // The margin keeps a timer that fires a hair early from leaving the approval in grace.
      Math.max(0, graceEndsAt - Date.now()) + 50
    )
    return () => clearTimeout(timer)
  }, [graceEndsAt])
  return lists
}
