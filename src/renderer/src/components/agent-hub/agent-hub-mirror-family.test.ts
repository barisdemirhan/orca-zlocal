import { describe, expect, it } from 'vitest'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import {
  LEAF_ID_UNKNOWN,
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3
} from './agent-hub-activity-test-fixtures'
import { buildAgentHubLineage } from './agent-hub-lineage'
import {
  agentHubMirrorFamily,
  agentHubMirrorFamilyRows,
  type AgentHubFamilyNode
} from './agent-hub-mirror-family'
import { agentHubThreadsFor as threadsFor } from './agent-hub-test-fixtures'

// tab-4 matches the fourth fixture's tab.
const PANE_KEY_4 = makePaneKey('tab-4', LEAF_ID_UNKNOWN)

// Dispatcher (1) → workers (2, 4); worker 2 → its own worker (3).
const threads = threadsFor([
  { paneKey: PANE_KEY, state: 'working', at: 1_000 },
  { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY },
  { paneKey: PANE_KEY_3, state: 'working', at: 1_000, parentPaneKey: PANE_KEY_2 },
  { paneKey: PANE_KEY_4, state: 'done', at: 1_000, parentPaneKey: PANE_KEY }
])
const lineage = buildAgentHubLineage(threads, 1_000)

type Row = { key: string; depth: number }
const rows = (nodes: readonly AgentHubFamilyNode[]): Row[] =>
  nodes.flatMap((node) => [{ key: node.thread.paneKey, depth: node.depth }, ...rows(node.children)])

function describeFamily(
  paneKey: string,
  source = threads,
  graph = lineage
): { path: string[]; ancestors: string[]; tree: Row[] } | null {
  const family = agentHubMirrorFamily(paneKey, source, graph)
  return (
    family && {
      path: family.path.map((thread) => thread.paneKey),
      ancestors: family.ancestors.map((thread) => thread.paneKey),
      tree: rows(family.tree)
    }
  )
}

describe('agentHubMirrorFamily', () => {
  it('hides a dispatcher above itself and nests its workers and their workers', () => {
    expect(describeFamily(PANE_KEY)).toEqual({
      path: [PANE_KEY],
      ancestors: [],
      tree: [
        { key: PANE_KEY_2, depth: 0 },
        { key: PANE_KEY_3, depth: 1 },
        { key: PANE_KEY_4, depth: 0 }
      ]
    })
  })

  it('shows a leaf worker beside its siblings, under its dispatcher', () => {
    expect(describeFamily(PANE_KEY_4)).toEqual({
      path: [PANE_KEY],
      ancestors: [PANE_KEY],
      tree: [
        { key: PANE_KEY_2, depth: 0 },
        { key: PANE_KEY_3, depth: 1 },
        { key: PANE_KEY_4, depth: 0 }
      ]
    })
  })

  it('lists only the children of a worker that dispatched, and keeps the way back up', () => {
    expect(describeFamily(PANE_KEY_2)).toEqual({
      path: [PANE_KEY, PANE_KEY_2],
      ancestors: [PANE_KEY],
      tree: [{ key: PANE_KEY_3, depth: 0 }]
    })
    expect(describeFamily(PANE_KEY_3)).toEqual({
      path: [PANE_KEY, PANE_KEY_2],
      ancestors: [PANE_KEY, PANE_KEY_2],
      tree: [{ key: PANE_KEY_3, depth: 0 }]
    })
  })

  it('stops at a dispatch cycle instead of repeating rows', () => {
    const looped = threadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1_000, parentPaneKey: PANE_KEY_2 },
      { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY }
    ])
    const family = describeFamily(PANE_KEY, looped, buildAgentHubLineage(looped, 1_000))
    const keys = family?.tree.map((row) => row.key) ?? []
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).not.toContain(PANE_KEY)
  })

  it('has no family for an agent that neither dispatched nor was dispatched', () => {
    const lone = threadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1_000 }])
    expect(agentHubMirrorFamily(PANE_KEY, lone, buildAgentHubLineage(lone, 1_000))).toBeNull()
  })
})

it('keeps sibling levels together and unfolds only the path to the viewed member', () => {
  const family = agentHubMirrorFamily(PANE_KEY, threads, lineage)
  if (!family) {
    throw new Error('No family')
  }
  const levels = (key: string) =>
    agentHubMirrorFamilyRows(family, key).map((row) => ({
      parent: row.parentKey,
      keys: row.nodes.map((node) => node.thread.paneKey)
    }))
  expect(levels(PANE_KEY)).toEqual([{ parent: null, keys: [PANE_KEY_2, PANE_KEY_4] }])
  expect(levels(PANE_KEY_4)).toEqual([{ parent: null, keys: [PANE_KEY_2, PANE_KEY_4] }])
  expect(levels(PANE_KEY_3)).toEqual([
    { parent: null, keys: [PANE_KEY_2, PANE_KEY_4] },
    { parent: PANE_KEY_2, keys: [PANE_KEY_3] }
  ])
})
