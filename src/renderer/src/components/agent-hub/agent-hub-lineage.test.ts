import { describe, expect, it } from 'vitest'
import {
  makeRepo,
  makeWorktree,
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3
} from './agent-hub-activity-test-fixtures'
import {
  activeAgentHubChildren,
  agentHubChildCounts,
  buildAgentHubLineage,
  visibleAgentHubRunningThreads
} from './agent-hub-lineage'
import { agentHubCounts, buildAgentHubLists } from './agent-hub-lists'
import { agentHubThreadsFor as threadsFor } from './agent-hub-test-fixtures'
import { buildAgentHubTerminalTree } from './agent-hub-terminal-tree'
import { visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'

const paneKeys = (threads: readonly { paneKey: string }[]): string[] =>
  threads.map((thread) => thread.paneKey)

describe('agent hub lineage', () => {
  it('folds working workers under their working dispatcher but keeps a waiting one in the Inbox', () => {
    const threads = threadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1_000 },
      { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY },
      { paneKey: PANE_KEY_3, state: 'waiting', at: 1_000, parentPaneKey: PANE_KEY }
    ])
    const lineage = buildAgentHubLineage(threads, 1_000)
    const lists = buildAgentHubLists(threads, { parentOf: lineage.parentOf })

    expect(paneKeys(lineage.childrenOf(PANE_KEY).workers).sort()).toEqual([PANE_KEY_2, PANE_KEY_3])
    expect(paneKeys(lists.working)).toEqual([PANE_KEY])
    expect(paneKeys(lists.needsYou)).toEqual([PANE_KEY_3])
    expect(agentHubCounts(lists)).toEqual({
      needsYou: 1,
      working: 1,
      finished: 0,
      nestedWorking: 1
    })
    expect(paneKeys(visibleAgentHubRunningThreads(lists.working, lineage, new Set()))).toEqual([
      PANE_KEY
    ])
    expect(
      paneKeys(visibleAgentHubRunningThreads(lists.working, lineage, new Set([PANE_KEY])))
    ).toEqual([PANE_KEY, PANE_KEY_2])
  })

  it('lists a working worker as its own row while its dispatcher is not working', () => {
    const threads = threadsFor([
      { paneKey: PANE_KEY, state: 'waiting', at: 1_000 },
      { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY }
    ])
    const lineage = buildAgentHubLineage(threads, 1_000)
    const lists = buildAgentHubLists(threads, { parentOf: lineage.parentOf })

    expect(paneKeys(lists.working)).toEqual([PANE_KEY_2])
    expect(lists.nestedWorking).toBe(0)
  })

  it("keeps a finished worker's result out of the Inbox", () => {
    const threads = threadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1_000 },
      { paneKey: PANE_KEY_2, state: 'done', at: 1_000, parentPaneKey: PANE_KEY }
    ])
    const lineage = buildAgentHubLineage(threads, 1_000)

    expect(buildAgentHubLists(threads, { parentOf: lineage.parentOf }).finished).toEqual([])
    expect(agentHubChildCounts(lineage.childrenOf(PANE_KEY))).toEqual({
      needsYou: 0,
      working: 0,
      finished: 1
    })
  })

  it("reads an agent's in-process subagents and keeps only live ones for Running", () => {
    const threads = threadsFor([
      {
        paneKey: PANE_KEY,
        state: 'working',
        at: 1_000,
        subagents: [
          { id: 'sub-1', state: 'working', description: 'Explore auth', startedAt: 500 },
          { id: 'sub-2', state: 'idle', description: 'Write tests', startedAt: 600 }
        ]
      }
    ])
    const children = buildAgentHubLineage(threads, 1_000).childrenOf(PANE_KEY)

    expect(children.subagents.map((row) => row.name)).toEqual(['Explore auth', 'Write tests'])
    expect(activeAgentHubChildren(children).subagents.map((row) => row.name)).toEqual([
      'Explore auth'
    ])
    expect(agentHubChildCounts(children)).toEqual({ needsYou: 0, working: 1, finished: 0 })
  })

  it('nests worker rows under their dispatcher in All terminals', () => {
    const threads = threadsFor([
      { paneKey: PANE_KEY, state: 'working', at: 1_000 },
      { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY },
      { paneKey: PANE_KEY_3, state: 'done', at: 1_000 }
    ])
    const repo = makeRepo()
    const worktree = makeWorktree()
    const groups = buildAgentHubTerminalTree({
      projectGroups: [],
      repos: [repo],
      worktreesByRepo: { [repo.id]: [worktree] },
      folderWorkspaces: [],
      tabsByWorktree: {
        [worktree.id]: threads.map((thread) => thread.tab).sort((a, b) => a.id.localeCompare(b.id))
      },
      threads,
      floating: null,
      includeShells: true,
      ungroupedLabel: 'Ungrouped',
      unknownProjectLabel: 'Unknown',
      parentOf: buildAgentHubLineage(threads, 1_000).parentOf
    })
    const rows = groups[0]?.workspaces[0]?.rows ?? []

    expect(rows.map((row) => row.paneKey)).toEqual([PANE_KEY, PANE_KEY_3])
    expect(rows[0]?.children.map((row) => row.paneKey)).toEqual([PANE_KEY_2])
    expect(groups[0]?.rowCount).toBe(3)
    expect(visibleAgentHubTreeRows(groups, new Map(), false).map((row) => row.paneKey)).toEqual([
      PANE_KEY,
      PANE_KEY_3
    ])
    expect(
      visibleAgentHubTreeRows(groups, new Map(), false, new Set([PANE_KEY])).map(
        (row) => row.paneKey
      )
    ).toEqual([PANE_KEY, PANE_KEY_2, PANE_KEY_3])
  })
})
