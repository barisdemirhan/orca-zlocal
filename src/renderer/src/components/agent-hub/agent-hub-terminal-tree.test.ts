import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'
import { agentHubTabsByWorktree } from './agent-hub-chat-tabs'
import { buildActivityEvents } from '../activity/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktreeWithId,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  agentOnlyAgentHubTree,
  buildAgentHubTerminalTree,
  type AgentHubGroupNode,
  type AgentHubTerminalTreeInput
} from './agent-hub-terminal-tree'
import {
  filterAgentHubTerminalTree,
  filterAgentHubTerminalTreeRows,
  isAgentHubGroupCollapsed,
  isAgentHubTreeNarrowed,
  visibleAgentHubTreeRows
} from './agent-hub-terminal-tree-view'
import { createAgentHubMirrorWindow } from './agent-hub-mirror-membership'
import { paneTargetFromTerminalRow } from './agent-hub-pane-target'
import { agentHubWindowFilterRowTest } from './agent-hub-window-filter'

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

// tab-1 in wt-mobile hosts a waiting Claude agent; every other tab is a plain shell.
function treeInput(): AgentHubTerminalTreeInput {
  const mobile = repo('repo-mobile', 'mobile', 'group-northwind')
  const api = repo('repo-api', 'api', 'group-northwind')
  const scratch = repo('repo-scratch', 'scratch', null)
  const wtMobile = makeWorktreeWithId('wt-mobile', mobile.id, 'main')
  const wtApi = makeWorktreeWithId('wt-api', api.id, 'main')
  const wtArchived = { ...makeWorktreeWithId('wt-old', api.id, 'old'), isArchived: true }
  const wtScratch = makeWorktreeWithId('wt-scratch', scratch.id, 'main')
  const floating = makeWorktreeWithId('global-floating-terminal', 'floating', 'Floating terminal')
  const tabsByWorktree = {
    [wtMobile.id]: [
      makeTabWithIds('tab-1', wtMobile.id, 'Claude'),
      makeTabWithIds('tab-metro', wtMobile.id, 'yarn start')
    ],
    [wtApi.id]: [makeTabWithIds('tab-serve', wtApi.id, 'php artisan serve')],
    [wtArchived.id]: [makeTabWithIds('tab-old', wtArchived.id, 'zsh')],
    [wtScratch.id]: [makeTabWithIds('tab-zsh', wtScratch.id, 'zsh')],
    [floating.id]: [makeTabWithIds('tab-float', floating.id, '~/Developer')]
  }
  const threads = makeThreads(
    buildActivityEvents({
      chatNames: new Map(),
      agentStatusByPaneKey: acceptedAgentStatuses(
        Object.entries({
          [PANE_KEY]: {
            state: 'waiting',
            prompt: 'Plan onboarding',
            updatedAt: 1_000,
            stateStartedAt: 1_000,
            paneKey: PANE_KEY,
            terminalTitle: 'Claude',
            stateHistory: [],
            agentType: 'claude'
          } satisfies AgentStatusEntry
        })
      ),
      tabsByWorktree,
      worktreeMap: new Map([[wtMobile.id, wtMobile]]),
      repoMap: new Map([[mobile.id, mobile]]),
      acknowledgedAgentsByPaneKey: {},
      now: 1_000
    })
  )
  return {
    // Declared out of order: tabOrder, not array order, decides the display order.
    projectGroups: [group('group-other', 'Other', 2), group('group-northwind', 'Northwind', 1)],
    repos: [mobile, api, scratch],
    worktreesByRepo: {
      [mobile.id]: [wtMobile],
      [api.id]: [wtApi, wtArchived],
      [scratch.id]: [wtScratch]
    },
    folderWorkspaces: [],
    tabsByWorktree,
    threads,
    floating: { worktree: floating, label: 'Floating terminal' },
    includeShells: true,
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Unknown'
  }
}

describe('buildAgentHubTerminalTree', () => {
  it('nests terminals under group, project and workspace in sidebar order', () => {
    const groups = buildAgentHubTerminalTree(treeInput())

    expect(groups.map((node) => node.label)).toEqual([
      'Northwind',
      'Ungrouped',
      'Floating terminal'
    ])
    expect(groups[0]?.workspaces.map((workspace) => workspace.projectLabel)).toEqual([
      'mobile',
      'api'
    ])
    expect(groups[0]?.workspaces[0]?.rows.map((row) => row.tab.id)).toEqual(['tab-1', 'tab-metro'])
  })

  it('keeps archived workspaces and empty groups out', () => {
    const groups = buildAgentHubTerminalTree(treeInput())
    const tabIds = groups.flatMap((node) =>
      node.workspaces.flatMap((workspace) => workspace.rows.map((row) => row.tab.id))
    )

    expect(tabIds).not.toContain('tab-old')
    expect(groups.map((node) => node.key)).not.toContain('group-other')
  })

  it('keeps a worktree whose repo left the catalog, under Unknown', () => {
    const input = treeInput()
    const orphan = makeWorktreeWithId('wt-orphan', 'repo-gone', 'main')
    const groups = buildAgentHubTerminalTree({
      ...input,
      worktreesByRepo: { ...input.worktreesByRepo, 'repo-gone': [orphan] },
      tabsByWorktree: {
        ...input.tabsByWorktree,
        [orphan.id]: [makeTabWithIds('tab-orphan', orphan.id)]
      }
    })

    const ungrouped = groups.find((node) => node.label === 'Ungrouped')
    expect(ungrouped?.workspaces.map((workspace) => workspace.projectLabel)).toEqual([
      'scratch',
      'Unknown'
    ])
  })

  it('lists a chat that replaced the last terminal of its workspace', () => {
    const input = treeInput()
    const chat = {
      id: 'agent-chat-tab-v1-1',
      entityId: 'session-1',
      contentType: 'agent-session',
      worktreeId: 'wt-api',
      label: 'Continued chat',
      agentSessionAgent: 'claude'
    } as Tab
    const groups = buildAgentHubTerminalTree({
      ...input,
      tabsByWorktree: agentHubTabsByWorktree({
        tabsByWorktree: { ...input.tabsByWorktree, 'wt-api': [] },
        unifiedTabsByWorktree: { 'wt-api': [chat] }
      })
    })

    const api = groups[0]?.workspaces.find((workspace) => workspace.projectLabel === 'api')
    expect(api?.rows.map((row) => [row.tab.id, row.title])).toEqual([
      ['agent-chat-tab-v1-1', 'Continued chat']
    ])
  })

  it('gives agent panes their thread and counts them per group', () => {
    const [northwind] = buildAgentHubTerminalTree(treeInput())
    const [agentRow, shellRow] = northwind?.workspaces[0]?.rows ?? []

    expect(agentRow?.paneKey).toBe(PANE_KEY)
    expect(agentRow?.thread?.paneKey).toBe(PANE_KEY)
    expect(shellRow?.paneKey).toBeNull()
    expect(shellRow?.title).toBe('yarn start')
    expect(northwind?.counts).toEqual({ needsYou: 1, working: 0, finished: 0 })
    expect(northwind?.rowCount).toBe(3)
  })
})

describe('agent hub tree filtering and collapse', () => {
  it('matches every query word across terminal, project and group names', () => {
    const groups = buildAgentHubTerminalTree(treeInput())

    const filtered = filterAgentHubTerminalTree(groups, 'northwind artisan')
    expect(filtered.map((node) => node.label)).toEqual(['Northwind'])
    expect(filtered[0]?.rowCount).toBe(1)
    expect(filterAgentHubTerminalTree(groups, 'no-such-terminal')).toEqual([])
  })

  it('narrows rows to those open in a window, minimized, or in neither', () => {
    const groups = buildAgentHubTerminalTree(treeInput())
    const allRows = (tree: readonly AgentHubGroupNode[]) =>
      tree.flatMap((node) => node.workspaces.flatMap((workspace) => workspace.rows))
    const rowOf = (tabId: string) => {
      const row = allRows(groups).find((entry) => entry.tab.id === tabId)
      if (!row) {
        throw new Error(`No row ${tabId}`)
      }
      return row
    }
    const mirrors = {
      windows: [createAgentHubMirrorWindow(paneTargetFromTerminalRow(rowOf('tab-serve')))],
      chips: [
        {
          window: createAgentHubMirrorWindow(paneTargetFromTerminalRow(rowOf('tab-zsh'))),
          minimizedAt: 1
        }
      ]
    }
    const filtered = (
      tree: readonly AgentHubGroupNode[],
      filter: 'open' | 'minimized' | 'none'
    ): AgentHubGroupNode[] => {
      const keep = agentHubWindowFilterRowTest(filter, mirrors)
      if (!keep) {
        throw new Error('A window filter always tests rows')
      }
      return filterAgentHubTerminalTreeRows(tree, keep)
    }
    const tabIds = (filter: 'open' | 'minimized' | 'none'): string[] =>
      allRows(filtered(groups, filter)).map((row) => row.tab.id)

    expect(tabIds('open')).toEqual(['tab-serve'])
    expect(tabIds('minimized')).toEqual(['tab-zsh'])
    expect(tabIds('none')).not.toContain('tab-serve')
    expect(tabIds('none')).not.toContain('tab-zsh')
    expect(tabIds('none')).toContain('tab-metro')

    // A dispatcher outside any window stays only as the path to its windowed worker, unfolded.
    const [first] = groups
    const workspace = first?.workspaces[0]
    if (!first || !workspace) {
      throw new Error('expected a group with a workspace')
    }
    const dispatcher = { ...rowOf('tab-metro'), children: [rowOf('tab-serve'), rowOf('tab-zsh')] }
    const family = [{ ...first, workspaces: [{ ...workspace, rows: [dispatcher] }] }]
    const open = filtered(family, 'open')
    expect(allRows(open).map((row) => row.children.map((child) => child.tab.id))).toEqual([
      ['tab-serve']
    ])
    expect(
      visibleAgentHubTreeRows(open, new Map(), isAgentHubTreeNarrowed('', 'open')).map(
        (row) => row.tab.id
      )
    ).toEqual(['tab-metro', 'tab-serve'])
  })

  it('starts shell-only groups collapsed, lets the user override, and expands while searching', () => {
    const groups = buildAgentHubTerminalTree(treeInput())
    const [northwind, ungrouped] = groups
    if (!northwind || !ungrouped) {
      throw new Error('expected Northwind and Ungrouped groups')
    }

    expect(isAgentHubGroupCollapsed(northwind, new Map(), false)).toBe(false)
    expect(isAgentHubGroupCollapsed(ungrouped, new Map(), false)).toBe(true)
    expect(isAgentHubGroupCollapsed(ungrouped, new Map([[ungrouped.key, false]]), false)).toBe(
      false
    )
    expect(isAgentHubGroupCollapsed(ungrouped, new Map(), true)).toBe(false)
    expect(visibleAgentHubTreeRows(groups, new Map(), false).map((row) => row.tab.id)).toEqual([
      'tab-1',
      'tab-metro',
      'tab-serve'
    ])
  })

  it('lists agent panes only when shells are turned off', () => {
    const groups = buildAgentHubTerminalTree({ ...treeInput(), includeShells: false })
    const tabIds = groups.flatMap((node) =>
      node.workspaces.flatMap((workspace) => workspace.rows.map((row) => row.tab.id))
    )

    expect(tabIds).toEqual(['tab-1'])
  })

  it('keeps an idle agent tab among the agents, apart from plain shells', () => {
    const input: AgentHubTerminalTreeInput = {
      ...treeInput(),
      idleAgentOf: (tab) => (tab.id === 'tab-serve' ? 'codex' : null)
    }
    const all = buildAgentHubTerminalTree(input)
    const serve = all
      .flatMap((g) => g.workspaces.flatMap((w) => w.rows))
      .find((row) => row.tab.id === 'tab-serve')
    expect(serve).toMatchObject({ thread: null, idleAgent: 'codex' })
    const agents = agentOnlyAgentHubTree(all)
    expect(
      agents.flatMap((g) => g.workspaces.flatMap((w) => w.rows.map((row) => row.tab.id)))
    ).toEqual(['tab-1', 'tab-serve'])
    expect(agents[0]?.rowCount).toBe(2)
    // With shells off, the idle agent still lists.
    const agentsOnly = buildAgentHubTerminalTree({ ...input, includeShells: false })
    expect(agentsOnly[0]?.agentRowCount).toBe(2)
  })
})
