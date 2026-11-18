import { expect, it } from 'vitest'
import {
  makeTabWithIds,
  makeWorktree,
  PANE_KEY,
  PANE_KEY_2
} from './agent-hub-activity-test-fixtures'
import { buildAgentHubTerminalTree } from './agent-hub-terminal-tree'
import {
  availableAgentHubPickerTree,
  availableAgentHubPickerParents
} from './agent-hub-picker-tree'
import { createAgentHubMirrorWindow } from './agent-hub-mirror-membership'
import { paneTargetFromTerminalRow, paneTargetFromThread } from './agent-hub-pane-target'
import { visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'

it('keeps workers of a reserved parent under their own workspace before nesting', () => {
  const parentKey = PANE_KEY
  const childKey = PANE_KEY_2
  const [parent, child] = agentHubThreadsFor([
    { paneKey: parentKey, state: 'working', at: 1000 },
    { paneKey: childKey, state: 'working', at: 1000, parentPaneKey: parentKey }
  ])
  if (!parent || !child) {
    throw new Error('No threads')
  }
  const other = { ...child.worktree, id: 'worker-workspace' }
  const worker = { ...child, worktree: other, tab: { ...child.tab, worktreeId: other.id } }
  const threads = [parent, worker]
  const mirrors = {
    windows: [createAgentHubMirrorWindow(paneTargetFromThread(parent, 'Parent'))],
    chips: []
  }
  const parentOf = availableAgentHubPickerParents(
    new Map([[childKey, parentKey]]),
    threads,
    mirrors
  )
  const tree = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [],
    worktreesByRepo: { [parent.worktree.repoId]: [parent.worktree, other] },
    folderWorkspaces: [],
    tabsByWorktree: { [parent.worktree.id]: [parent.tab], [other.id]: [worker.tab] },
    threads,
    parentOf,
    floating: null,
    includeShells: true,
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Project'
  })
  const filtered = availableAgentHubPickerTree(tree, mirrors)
  expect(parentOf.size).toBe(0)
  expect(filtered[0]?.workspaces.map((workspace) => workspace.worktree.id)).toEqual([other.id])
  expect(filtered[0]?.workspaces[0]?.rows[0]?.tab.id).toBe(worker.tab.id)
  expect(
    availableAgentHubPickerParents(new Map([[childKey, parentKey]]), threads, {
      windows: [],
      chips: []
    }).get(childKey)
  ).toBe(parentKey)
})

function fixture() {
  const worktree = makeWorktree()
  const groups = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [],
    worktreesByRepo: { [worktree.repoId]: [worktree] },
    folderWorkspaces: [],
    tabsByWorktree: {
      [worktree.id]: ['a', 'b', 'c'].map((id) => makeTabWithIds(id, worktree.id, id))
    },
    threads: [],
    floating: null,
    includeShells: true,
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Project'
  })
  const rows = groups[0]?.workspaces[0]?.rows
  if (!rows || rows.length !== 3) {
    throw new Error('No rows')
  }
  return { groups, rows }
}
it('filters source aliases in both open and parked windows before counting', () => {
  const { groups, rows } = fixture()
  const [a, b] = rows
  if (!a || !b) {
    throw new Error('No rows')
  }
  const filtered = availableAgentHubPickerTree(groups, {
    windows: [
      createAgentHubMirrorWindow({ ...paneTargetFromTerminalRow(a), paneKey: 'a:other-leaf' })
    ],
    chips: [{ window: createAgentHubMirrorWindow(paneTargetFromTerminalRow(b)), minimizedAt: 0 }]
  })
  expect(filtered[0]?.rowCount).toBe(1)
  expect(visibleAgentHubTreeRows(filtered, new Map(), true).map((row) => row.tab.id)).toEqual(['c'])
})
it('promotes eligible workers without retaining a reserved dispatcher row', () => {
  const { groups, rows } = fixture()
  const [parent, child, third] = rows
  if (!parent || !child || !third) {
    throw new Error('No rows')
  }
  parent.children = [child]
  const workspace = groups[0]?.workspaces[0]
  if (!workspace) {
    throw new Error('No workspace')
  }
  workspace.rows = [parent, third]
  const filtered = availableAgentHubPickerTree(groups, {
    windows: [createAgentHubMirrorWindow(paneTargetFromTerminalRow(parent))],
    chips: []
  })
  expect(filtered[0]?.workspaces[0]?.rows.map((row) => row.tab.id)).toEqual(['b', 'c'])
  expect(filtered[0]?.rowCount).toBe(2)
})
it('prunes groups when all sources are reserved', () => {
  const { groups, rows } = fixture()
  expect(
    availableAgentHubPickerTree(groups, {
      windows: rows.map((row) => createAgentHubMirrorWindow(paneTargetFromTerminalRow(row))),
      chips: []
    })
  ).toEqual([])
})
