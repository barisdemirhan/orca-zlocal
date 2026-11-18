import type { AgentPaneThread } from '../activity/threads/activity-thread-types'
import type { AgentHubLineage } from './agent-hub-lineage'

export type AgentHubFamilyNode = {
  thread: AgentPaneThread
  /** 0 for the first row under the bar's dispatcher chain. */
  depth: number
  children: readonly AgentHubFamilyNode[]
}

/**
 * Where a mirrored pane sits in its orchestration tree, for the bar under the mirror's header.
 * `path` runs from the top dispatcher down to the agent whose workers are listed: the shown pane
 * itself when it dispatched workers, else its own dispatcher, so a worker sees its siblings.
 * `ancestors` is `path` without the shown pane, so a dispatcher is never listed above itself.
 */
export type AgentHubMirrorFamily = {
  path: readonly AgentPaneThread[]
  ancestors: readonly AgentPaneThread[]
  tree: readonly AgentHubFamilyNode[]
}

/** Only the viewed branch unfolds; siblings always share one row. */
export function agentHubMirrorFamilyRows(
  family: AgentHubMirrorFamily,
  activeKey: string
): { nodes: readonly AgentHubFamilyNode[]; parentKey: string | null }[] {
  const pathTo = (nodes: readonly AgentHubFamilyNode[]): AgentHubFamilyNode[] | null => {
    for (const node of nodes) {
      if (node.thread.paneKey === activeKey) {
        return [node]
      }
      const path = pathTo(node.children)
      if (path) {
        return [node, ...path]
      }
    }
    return null
  }
  return [
    { nodes: family.tree, parentKey: null },
    ...(pathTo(family.tree) ?? []).flatMap((node) =>
      node.children.length ? [{ nodes: node.children, parentKey: node.thread.paneKey }] : []
    )
  ]
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
  const path = pathKeys.flatMap((key) => threadByKey.get(key) ?? [])
  // Why `visited` is shared: a cycle or a worker listed twice must not repeat or recurse forever.
  const visited = new Set(pathKeys)
  const build = (key: string, depth: number): AgentHubFamilyNode[] =>
    workersOf(key)
      // Dispatch order, so rows stay put while their workers' activity reorders the hub.
      .toSorted((a, b) => a.tab.createdAt - b.tab.createdAt || a.paneKey.localeCompare(b.paneKey))
      .filter((thread) => !visited.has(thread.paneKey) && visited.add(thread.paneKey))
      .map((thread) => ({ thread, depth, children: build(thread.paneKey, depth + 1) }))
  return {
    path,
    ancestors: path.filter((thread) => thread.paneKey !== paneKey),
    tree: build(listedKey, 0)
  }
}
