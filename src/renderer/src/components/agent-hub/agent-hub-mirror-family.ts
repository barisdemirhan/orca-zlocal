import type { AgentPaneThread } from '../activity/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'

export type AgentHubFamilyMember = {
  thread: AgentPaneThread
  /** Workers this one dispatched itself; a member with some can be opened a level deeper. */
  childCount: number
}

/**
 * Where a mirrored pane sits in its orchestration tree, for the bar under the mirror's header.
 * `path` runs from the top dispatcher down to the agent whose workers are listed: the shown pane
 * itself when it dispatched workers, else its own dispatcher, so a worker sees its siblings.
 */
export type AgentHubMirrorFamily = {
  path: readonly AgentPaneThread[]
  members: readonly AgentHubFamilyMember[]
}

export function agentHubMirrorFamily(
  paneKey: string,
  threads: readonly AgentPaneThread[],
  lineage: AgentHubLineage
): AgentHubMirrorFamily | null {
  const workersOf = (key: string): readonly AgentPaneThread[] => lineage.childrenOf(key).workers
  const listedKey = workersOf(paneKey).length > 0 ? paneKey : lineage.parentOf.get(paneKey)
  if (!listedKey) {
    return null
  }
  const pathKeys = [listedKey]
  // Why the guard: malformed orchestration metadata can point a dispatcher back at its worker.
  const seen = new Set(pathKeys)
  for (
    let parent = lineage.parentOf.get(listedKey);
    parent && !seen.has(parent);
    parent = lineage.parentOf.get(parent)
  ) {
    pathKeys.unshift(parent)
    seen.add(parent)
  }
  const threadByKey = new Map(threads.map((thread) => [thread.paneKey, thread]))
  return {
    path: pathKeys.flatMap((key) => threadByKey.get(key) ?? []),
    // Dispatch order, so tabs stay put while their workers' activity reorders the hub.
    members: workersOf(listedKey)
      .toSorted((a, b) => a.tab.createdAt - b.tab.createdAt || a.paneKey.localeCompare(b.paneKey))
      .map((thread) => ({ thread, childCount: workersOf(thread.paneKey).length }))
  }
}
