import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '../dashboard/rows/dashboard-agent-row'
import {
  makeRepo,
  makeWorktree,
  makeTabWithIds,
  PANE_KEY
} from './agent-hub-activity-test-fixtures'
import { buildAgentHubTerminalTree } from './agent-hub-terminal-tree'
import {
  agentHubSidebarPopoutTarget,
  canPopOutAgentHubSidebarRow
} from './agent-hub-sidebar-popout'

function fixture(folder = false, ssh = false) {
  const repo = { ...makeRepo(), ...(ssh ? { connectionId: 'ssh-host' } : {}) }
  const worktree = makeWorktree()
  const tab = makeTabWithIds('tab-1', folder ? 'folder:folder-1' : worktree.id)
  const agent: DashboardAgentRow = {
    paneKey: PANE_KEY,
    tab,
    agentType: 'claude',
    state: 'working',
    startedAt: 1,
    entry: {
      prompt: 'Agent task',
      paneKey: PANE_KEY,
      state: 'working',
      updatedAt: 1,
      stateStartedAt: 1,
      terminalTitle: 'Claude',
      stateHistory: [],
      agentType: 'claude'
    }
  }
  const tree = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [repo],
    worktreesByRepo: folder ? {} : { [repo.id]: [worktree] },
    folderWorkspaces: folder
      ? [
          {
            id: 'folder-1',
            projectGroupId: '',
            name: 'Folder',
            folderPath: '/folder',
            connectionId: ssh ? 'ssh-host' : null,
            linkedTask: null,
            comment: '',
            isArchived: false,
            isUnread: false,
            isPinned: false,
            sortOrder: 0,
            lastActivityAt: 1,
            createdAt: 1,
            updatedAt: 1
          }
        ]
      : [],
    tabsByWorktree: { [tab.worktreeId]: [tab] },
    threads: [],
    floating: null,
    includeShells: true,
    ungroupedLabel: 'Other',
    unknownProjectLabel: 'Unknown'
  })
  return { agent, tree, worktreeId: tab.worktreeId }
}

describe('sidebar pop-out eligibility', () => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true]
  ])('uses the hub catalog for folder=%s SSH=%s', (folder, ssh) => {
    const { agent, tree, worktreeId } = fixture(folder, ssh)
    expect(agentHubSidebarPopoutTarget(agent, tree, true, 'other')?.worktree.id).toBe(worktreeId)
    expect(agentHubSidebarPopoutTarget(agent, tree, true, worktreeId)).toBeNull()
    expect(agentHubSidebarPopoutTarget(agent, tree, false, 'other')).toBeNull()
    expect(agentHubSidebarPopoutTarget(agent, tree, true, null)?.paneKey).toBe(PANE_KEY)
    expect(agentHubSidebarPopoutTarget(agent, [], true, 'other')).toBeNull()
  })
  it('does not invent panes for embedded child agents', () => {
    const { agent, tree } = fixture()
    const rowSource = 'subagent'
    expect(agentHubSidebarPopoutTarget({ ...agent, rowSource }, tree, true, null)).toBeNull()
    expect(canPopOutAgentHubSidebarRow({ ...agent, rowSource }, null)).toBe(false)
  })
  it('decides row eligibility from row data without the terminal tree', () => {
    const { agent, worktreeId } = fixture()
    expect(canPopOutAgentHubSidebarRow(agent, 'other')).toBe(true)
    expect(canPopOutAgentHubSidebarRow(agent, null)).toBe(true)
    expect(canPopOutAgentHubSidebarRow(agent, worktreeId)).toBe(false)
    expect(canPopOutAgentHubSidebarRow({ ...agent, paneKey: 'not-a-pane-key' }, 'other')).toBe(
      false
    )
  })
})
