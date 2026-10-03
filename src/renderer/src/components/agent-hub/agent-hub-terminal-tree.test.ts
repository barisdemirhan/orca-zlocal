import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import { buildActivityEvents } from '../activity/activity-event-builder'
import {
  makeRepo,
  makeTabWithIds,
  makeThreads,
  makeWorktreeWithId,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import {
  buildAgentHubTerminalTree,
  type AgentHubTerminalTreeInput
} from './agent-hub-terminal-tree'
import {
  filterAgentHubTerminalTree,
  isAgentHubGroupCollapsed,
  visibleAgentHubTreeRows
} from './agent-hub-terminal-tree-view'

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
      agentStatusByPaneKey: {
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
      },
      retainedAgentsByPaneKey: {},
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

    expect(groups.map((node) => node.label)).toEqual(['Northwind', 'Ungrouped', 'Floating terminal'])
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

  it('starts shell-only groups collapsed, lets the user override, and expands while searching', () => {
    const groups = buildAgentHubTerminalTree(treeInput())
    const [northwind, ungrouped] = groups
    if (!northwind || !ungrouped) {
      throw new Error('expected Northwind and Ungrouped groups')
    }

    expect(isAgentHubGroupCollapsed(northwind, new Map(), '')).toBe(false)
    expect(isAgentHubGroupCollapsed(ungrouped, new Map(), '')).toBe(true)
    expect(isAgentHubGroupCollapsed(ungrouped, new Map([[ungrouped.key, false]]), '')).toBe(false)
    expect(isAgentHubGroupCollapsed(ungrouped, new Map(), 'zsh')).toBe(false)
    expect(visibleAgentHubTreeRows(groups, new Map(), '').map((row) => row.tab.id)).toEqual([
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
})
