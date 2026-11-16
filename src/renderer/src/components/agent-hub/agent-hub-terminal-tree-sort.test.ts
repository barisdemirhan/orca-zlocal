import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeAgentHubTerminalSort,
  type AgentHubTerminalSort
} from '../../../../shared/agent-hub-settings'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { buildActivityEvents } from '../activity/activity-event-builder'
import {
  LEAF_ID,
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktreeWithId
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  agentOnlyAgentHubTree,
  buildAgentHubTerminalTree,
  type AgentHubGroupNode,
  type AgentHubTerminalRow
} from './agent-hub-terminal-tree'
import {
  rankAgentHubWorkspaces,
  sortAgentHubTerminalTree,
  type AgentHubWorkspaceRankSources
} from './agent-hub-terminal-tree-sort'
import { filterAgentHubTerminalTree, visibleAgentHubTreeRows } from './agent-hub-terminal-tree-view'

const NOW = 1_700_000_000_000
const SECOND = 1_000

function group(id: string, name: string, tabOrder: number): ProjectGroup {
  return {
    id,
    name,
    parentPath: null,
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1
  }
}

function repo(id: string, displayName: string, projectGroupId: string | null): Repo {
  return { ...makeRepo(), id, displayName, path: `/${id}`, projectGroupId }
}

function worktree(
  id: string,
  repoId: string,
  order: Pick<Worktree, 'lastActivityAt' | 'sortOrder' | 'manualOrder'>
): Worktree {
  return { ...makeWorktreeWithId(id, repoId, id.replace('wt-', '')), ...order }
}

function tab(id: string, worktreeId: string, title: string, createdAt: number): TerminalTab {
  return { ...makeTabWithIds(id, worktreeId, title), createdAt }
}

function paneKey(tabId: string): string {
  return makePaneKey(tabId, LEAF_ID)
}

type AgentFixture = {
  tabId: string
  state: AgentStatusEntry['state']
  secondsAgo: number
  read?: boolean
  parentTabId?: string
}

// Listed in tab order. Group tab order is Beta, Alpha; sidebar order of projects is mid, zeta, app.
const AGENTS: AgentFixture[] = [
  { tabId: 'm-read', state: 'done', secondsAgo: 50, read: true },
  { tabId: 'm-work', state: 'working', secondsAgo: 30 },
  { tabId: 'm-done', state: 'done', secondsAgo: 40 },
  { tabId: 'm-ask', state: 'waiting', secondsAgo: 20 },
  { tabId: 'z-worker-a', state: 'working', secondsAgo: 25, parentTabId: 'm-work' },
  { tabId: 'z-worker-b', state: 'waiting', secondsAgo: 15, parentTabId: 'm-work' },
  { tabId: 'a-ask', state: 'waiting', secondsAgo: 10 },
  { tabId: 'l-done', state: 'done', secondsAgo: 5 }
]

function fixture(agents: AgentFixture[] = AGENTS) {
  const mid = repo('repo-mid', 'mid', 'g-beta')
  const zeta = repo('repo-zeta', 'zeta', 'g-beta')
  const app = repo('repo-app', 'app', 'g-alpha')
  const loose = repo('repo-loose', 'loose', null)
  const wtMid = worktree('wt-mid', mid.id, { lastActivityAt: 300, sortOrder: 1, manualOrder: 20 })
  const wtZeta = worktree('wt-zeta', zeta.id, { lastActivityAt: 100, sortOrder: 7 })
  const wtApp = worktree('wt-app', app.id, { lastActivityAt: 200, sortOrder: 3, manualOrder: 10 })
  const wtLoose = worktree('wt-loose', loose.id, { lastActivityAt: 50, sortOrder: 9 })
  const wtOrphan = worktree('wt-orphan', 'repo-gone', { lastActivityAt: 60, sortOrder: 4 })
  const floating = worktree('global-floating-terminal', 'floating', {
    lastActivityAt: 0,
    sortOrder: 0
  })
  const notes: FolderWorkspace = {
    id: 'notes',
    projectGroupId: 'g-alpha',
    name: 'notes',
    folderPath: '/notes',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 2,
    lastActivityAt: 400,
    createdAt: 1,
    updatedAt: 1
  }
  const tabsByWorktree: Record<string, TerminalTab[]> = {
    [wtMid.id]: [
      tab('m-shell', wtMid.id, 'zsh', 10),
      tab('m-idle', wtMid.id, 'charlie', 20),
      tab('m-read', wtMid.id, 'alpha', 1),
      tab('m-work', wtMid.id, 'echo', 2),
      tab('m-done', wtMid.id, 'bravo', 3),
      tab('m-ask', wtMid.id, 'delta', 4)
    ],
    [wtZeta.id]: [
      tab('z-shell', wtZeta.id, 'zsh', 1),
      tab('z-worker-a', wtZeta.id, 'worker a', 2),
      tab('z-worker-b', wtZeta.id, 'worker b', 3)
    ],
    [wtApp.id]: [tab('a-ask', wtApp.id, 'app agent', 1)],
    'folder:notes': [tab('n-shell', 'folder:notes', 'vim', 1)],
    [wtLoose.id]: [tab('l-done', wtLoose.id, 'loose agent', 1)],
    [wtOrphan.id]: [tab('o-shell', wtOrphan.id, 'zsh', 1)],
    [floating.id]: [tab('f-shell', floating.id, '~/Developer', 1)]
  }
  const titleByTabId = new Map(
    Object.values(tabsByWorktree).flatMap((tabs) => tabs.map((item) => [item.id, item.title]))
  )
  const agentStatusByPaneKey: Record<string, AgentStatusEntry> = Object.fromEntries(
    agents.map((agent) => {
      const at = NOW - agent.secondsAgo * SECOND
      const title = titleByTabId.get(agent.tabId) ?? agent.tabId
      return [
        paneKey(agent.tabId),
        {
          state: agent.state,
          // The prompt is what the row is titled with.
          prompt: title,
          updatedAt: at,
          stateStartedAt: at,
          paneKey: paneKey(agent.tabId),
          terminalTitle: title,
          stateHistory: [],
          agentType: 'claude'
        } satisfies AgentStatusEntry
      ]
    })
  )
  const worktrees = [wtMid, wtZeta, wtApp, wtLoose, wtOrphan]
  const repos = [mid, zeta, app, loose]
  const threads = makeThreads(
    buildActivityEvents({
      chatNames: new Map(),
      agentStatusByPaneKey,
      retainedAgentsByPaneKey: {},
      tabsByWorktree,
      worktreeMap: new Map(worktrees.map((item) => [item.id, item])),
      repoMap: new Map(repos.map((item) => [item.id, item])),
      acknowledgedAgentsByPaneKey: Object.fromEntries(
        agents.filter((agent) => agent.read).map((agent) => [paneKey(agent.tabId), NOW])
      ),
      now: NOW
    })
  )
  const tree = buildAgentHubTerminalTree({
    projectGroups: [group('g-alpha', 'Alpha', 2), group('g-beta', 'Beta', 1)],
    repos,
    worktreesByRepo: {
      [mid.id]: [wtMid],
      [zeta.id]: [wtZeta],
      [app.id]: [wtApp],
      [loose.id]: [wtLoose],
      'repo-gone': [wtOrphan]
    },
    folderWorkspaces: [notes],
    tabsByWorktree,
    threads,
    floating: { worktree: floating, label: 'Floating terminal' },
    includeShells: true,
    idleAgentOf: (item) => (item.id === 'm-idle' ? 'codex' : null),
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Unknown',
    parentOf: new Map(
      agents.flatMap((agent) =>
        agent.parentTabId ? [[paneKey(agent.tabId), paneKey(agent.parentTabId)]] : []
      )
    )
  })
  const sources = (live: boolean): AgentHubWorkspaceRankSources => ({
    tabsByWorktree,
    agentStatusByPaneKey,
    runtimePaneTitlesByTabId: {},
    ptyIdsByTabId: live ? { 'm-ask': ['pty-m-ask'] } : {},
    migrationUnsupportedByPtyId: {},
    terminalLayoutsByTabId: {}
  })
  const repoMap = new Map(repos.map((item) => [item.id, item]))
  const sort = (
    sortBy: AgentHubTerminalSort,
    groups: readonly AgentHubGroupNode[] = tree,
    live = true
  ): AgentHubGroupNode[] =>
    sortAgentHubTerminalTree(groups, {
      sortBy,
      now: NOW,
      workspaceRank: rankAgentHubWorkspaces(tree, sortBy, sources(live), repoMap, NOW)
    })
  return { tree, sort }
}

const groupLabels = (groups: readonly AgentHubGroupNode[]): string[] =>
  groups.map((node) => node.label)

const workspaceKeys = (groups: readonly AgentHubGroupNode[], label: string): string[] =>
  groups.find((node) => node.label === label)?.workspaces.map((workspace) => workspace.key) ?? []

const rowTabIds = (rows: readonly AgentHubTerminalRow[] | undefined): string[] =>
  (rows ?? []).map((row) => row.tab.id)

function midRows(groups: readonly AgentHubGroupNode[]): AgentHubTerminalRow[] {
  return (
    groups.flatMap((node) => node.workspaces).find((workspace) => workspace.key === 'wt-mid')
      ?.rows ?? []
  )
}

const workerTabIds = (groups: readonly AgentHubGroupNode[]): string[] =>
  rowTabIds(midRows(groups).find((row) => row.tab.id === 'm-work')?.children)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeAgentHubTerminalSort', () => {
  it('defaults to Agent Activity and keeps each sidebar choice', () => {
    expect(normalizeAgentHubTerminalSort(undefined)).toBe('smart')
    expect(normalizeAgentHubTerminalSort('newest')).toBe('smart')
    for (const sortBy of ['name', 'smart', 'recent', 'repo', 'manual'] as const) {
      expect(normalizeAgentHubTerminalSort(sortBy)).toBe(sortBy)
    }
  })
})

describe('sortAgentHubTerminalTree', () => {
  it('Project keeps the tree as built: group tab order, projects, tabs', () => {
    const { tree, sort } = fixture()
    const sorted = sort('repo')

    expect(sorted).toEqual(tree)
    expect(groupLabels(sorted)).toEqual(['Beta', 'Alpha', 'Ungrouped', 'Floating terminal'])
    expect(workspaceKeys(sorted, 'Beta')).toEqual(['wt-mid', 'wt-zeta'])
    expect(rowTabIds(midRows(sorted))).toEqual([
      'm-shell',
      'm-idle',
      'm-read',
      'm-work',
      'm-done',
      'm-ask'
    ])
    expect(workerTabIds(sorted)).toEqual(['z-worker-a', 'z-worker-b'])
  })

  it('Name is alphabetical at every level', () => {
    const { sort } = fixture()
    const sorted = sort('name')

    expect(groupLabels(sorted)).toEqual(['Alpha', 'Beta', 'Floating terminal', 'Ungrouped'])
    expect(workspaceKeys(sorted, 'Alpha')).toEqual(['wt-app', 'folder:notes'])
    // "loose" before "Unknown", the label an unknown repo's worktree is listed under.
    expect(workspaceKeys(sorted, 'Ungrouped')).toEqual(['wt-loose', 'wt-orphan'])
    expect(rowTabIds(midRows(sorted))).toEqual([
      'm-read',
      'm-done',
      'm-idle',
      'm-ask',
      'm-work',
      'm-shell'
    ])
  })

  it('Recent puts the latest activity first at every level', () => {
    const { sort } = fixture()
    const sorted = sort('recent')

    // The folder workspace (400) leads Alpha; Beta follows with mid (300).
    expect(groupLabels(sorted)).toEqual(['Alpha', 'Beta', 'Ungrouped', 'Floating terminal'])
    expect(workspaceKeys(sorted, 'Alpha')).toEqual(['folder:notes', 'wt-app'])
    expect(workspaceKeys(sorted, 'Beta')).toEqual(['wt-mid', 'wt-zeta'])
    expect(workspaceKeys(sorted, 'Ungrouped')).toEqual(['wt-orphan', 'wt-loose'])
    // Agents by their latest event; thread-less rows by when their tab opened.
    expect(rowTabIds(midRows(sorted))).toEqual([
      'm-ask',
      'm-work',
      'm-done',
      'm-read',
      'm-idle',
      'm-shell'
    ])
    expect(workerTabIds(sorted)).toEqual(['z-worker-b', 'z-worker-a'])
  })

  it('Manual uses the sidebar order of workspaces and leaves groups and tabs alone', () => {
    const { sort } = fixture()
    const sorted = sort('manual')

    expect(groupLabels(sorted)).toEqual(['Beta', 'Alpha', 'Ungrouped', 'Floating terminal'])
    // manualOrder 20 beats the sortOrder 7 that stands in for a workspace never dragged.
    expect(workspaceKeys(sorted, 'Beta')).toEqual(['wt-mid', 'wt-zeta'])
    expect(workspaceKeys(sorted, 'Alpha')).toEqual(['wt-app', 'folder:notes'])
    expect(workspaceKeys(sorted, 'Ungrouped')).toEqual(['wt-loose', 'wt-orphan'])
    expect(rowTabIds(midRows(sorted))).toEqual([
      'm-shell',
      'm-idle',
      'm-read',
      'm-work',
      'm-done',
      'm-ask'
    ])
  })

  it('Agent Activity ranks needs-you, finished, working, then the rest, newest first', () => {
    const { sort } = fixture()
    const sorted = sort('smart')

    // app asked 10s ago; Beta's askers are older; loose only finished; the floating shell is idle.
    expect(groupLabels(sorted)).toEqual(['Alpha', 'Beta', 'Ungrouped', 'Floating terminal'])
    expect(workspaceKeys(sorted, 'Alpha')).toEqual(['wt-app', 'folder:notes'])
    expect(workspaceKeys(sorted, 'Ungrouped')).toEqual(['wt-loose', 'wt-orphan'])
    expect(rowTabIds(midRows(sorted))).toEqual([
      'm-ask',
      'm-done',
      'm-work',
      'm-read',
      'm-idle',
      'm-shell'
    ])
    // Workers stay under their dispatcher, the one that needs the user first.
    expect(workerTabIds(sorted)).toEqual(['z-worker-b', 'z-worker-a'])
  })

  it('Agent Activity stops ranking an old unread result above working agents', () => {
    // A result from two days ago is still unread, but it is no longer news.
    const { sort } = fixture([
      { tabId: 'm-done', state: 'done', secondsAgo: 2 * 24 * 60 * 60 },
      { tabId: 'm-work', state: 'working', secondsAgo: 30 }
    ])

    expect(rowTabIds(midRows(sort('smart'))).slice(0, 2)).toEqual(['m-work', 'm-done'])
  })

  it('Agent Activity ranks a workspace by the workers it lists from other workspaces', () => {
    // mid's own agent only works; its worker (in zeta) asks, so mid outranks app's finished agent.
    const { sort } = fixture([
      { tabId: 'm-work', state: 'working', secondsAgo: 30 },
      { tabId: 'z-worker-b', state: 'waiting', secondsAgo: 15, parentTabId: 'm-work' },
      { tabId: 'a-ask', state: 'done', secondsAgo: 10 }
    ])

    expect(groupLabels(sort('smart')).slice(0, 2)).toEqual(['Beta', 'Alpha'])
  })

  it('Agent Activity on a cold start falls back to the persisted sidebar order', () => {
    // Nothing reported yet and no terminal is live: every tab is an idle agent or a shell.
    const { sort } = fixture([])
    const sorted = sort('smart', undefined, false)

    // sortOrder: loose 9, zeta 7, orphan 4, app 3, notes 2, mid 1, floating 0.
    expect(groupLabels(sorted)).toEqual(['Ungrouped', 'Beta', 'Alpha', 'Floating terminal'])
    expect(workspaceKeys(sorted, 'Beta')).toEqual(['wt-zeta', 'wt-mid'])
    expect(workspaceKeys(sorted, 'Alpha')).toEqual(['wt-app', 'folder:notes'])
    // The idle agent leads; the rest are shells, newest tab first.
    expect(rowTabIds(midRows(sorted))).toEqual([
      'm-idle',
      'm-shell',
      'm-ask',
      'm-done',
      'm-work',
      'm-read'
    ])
  })

  it('orders a filtered tree by what is still listed', () => {
    const { tree, sort } = fixture()
    const filtered = filterAgentHubTerminalTree(tree, 'zsh')

    // Without the askers, the shells that are left sort by workspace recency.
    expect(groupLabels(sort('recent', filtered))).toEqual(['Beta', 'Ungrouped'])
    expect(groupLabels(sort('name', filtered))).toEqual(['Beta', 'Ungrouped'])
    expect(rowTabIds(midRows(sort('smart', filterAgentHubTerminalTree(tree, 'mid'))))).toEqual([
      'm-ask',
      'm-done',
      'm-work',
      'm-read',
      'm-idle',
      'm-shell'
    ])
  })

  it('orders the Agents tab, which lists no shells', () => {
    const { tree, sort } = fixture()
    const sorted = sort('smart', agentOnlyAgentHubTree(tree))

    expect(groupLabels(sorted)).toEqual(['Alpha', 'Beta', 'Ungrouped'])
    expect(rowTabIds(midRows(sorted))).toEqual(['m-ask', 'm-done', 'm-work', 'm-read', 'm-idle'])
  })

  it('walks the arrow keys through the sorted order', () => {
    const { sort } = fixture()
    const visible = (sortBy: AgentHubTerminalSort): string[] =>
      rowTabIds(visibleAgentHubTreeRows(sort(sortBy), new Map(), false))

    expect(visible('repo').slice(0, 3)).toEqual(['m-shell', 'm-idle', 'm-read'])
    expect(visible('smart').slice(0, 3)).toEqual(['a-ask', 'n-shell', 'm-ask'])
    // A collapsed group is skipped wherever the sort puts it.
    expect(
      rowTabIds(visibleAgentHubTreeRows(sort('smart'), new Map([['g-alpha', true]]), false)).at(0)
    ).toBe('m-ask')
  })

  it('leaves the tree it was given untouched', () => {
    const { tree, sort } = fixture()
    const before = rowTabIds(midRows(tree))
    sort('smart')

    expect(rowTabIds(midRows(tree))).toEqual(before)
    expect(groupLabels(tree)).toEqual(['Beta', 'Alpha', 'Ungrouped', 'Floating terminal'])
  })
})
