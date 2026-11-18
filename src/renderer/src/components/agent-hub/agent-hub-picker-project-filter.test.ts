import { describe, expect, it } from 'vitest'
import { folderWorkspaceRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../shared/worktree/types'
import { makeRepo, makeTabWithIds, makeWorktreeWithId } from './agent-hub-activity-test-fixtures'
import {
  agentHubPickerProjectKey,
  agentHubPickerProjectKeys,
  agentHubPickerProjects,
  filterAgentHubTreeByProjects
} from './agent-hub-picker-project-filter'
import {
  countRows,
  type AgentHubGroupNode,
  type AgentHubTerminalRow
} from './agent-hub-terminal-tree'

function row(worktree: Worktree, tabId: string, children: AgentHubTerminalRow[] = []) {
  return {
    key: tabId,
    worktree,
    repo: { ...makeRepo(), id: worktree.repoId, displayName: `repo ${worktree.repoId}` },
    tab: makeTabWithIds(tabId, worktree.id),
    paneKey: `${tabId}:leaf`,
    title: tabId,
    thread: null,
    idleAgent: 'claude',
    children
  } satisfies AgentHubTerminalRow
}

function tree(...workspaces: [Worktree, string, AgentHubTerminalRow[]][]): AgentHubGroupNode[] {
  const nodes = workspaces.map(([worktree, label, rows]) => ({
    key: worktree.id,
    worktree,
    projectLabel: label,
    workspaceLabel: null,
    rows
  }))
  return [{ key: 'group', label: 'Group', workspaces: nodes, ...countRows(nodes) }]
}

const api = makeWorktreeWithId('wt-api', 'repo-api')
const web = makeWorktreeWithId('wt-web', 'repo-web')
const remoteApi: Worktree = {
  ...makeWorktreeWithId('wt-api-workhost', 'repo-api'),
  hostId: 'runtime:workhost'
}

describe('agent hub picker project filter', () => {
  it('keys a project per host, and each folder workspace on its own', () => {
    const folderA = makeWorktreeWithId('folder-a', folderWorkspaceRepoId('group-1'))
    const folderB = makeWorktreeWithId('folder-b', folderWorkspaceRepoId('group-1'))
    expect(agentHubPickerProjectKey(api)).toBe(
      agentHubPickerProjectKey(makeWorktreeWithId('wt-api-2', 'repo-api'))
    )
    expect(agentHubPickerProjectKey(api)).not.toBe(agentHubPickerProjectKey(remoteApi))
    expect(agentHubPickerProjectKey(folderA)).not.toBe(agentHubPickerProjectKey(folderB))
    expect(agentHubPickerProjectKeys([api, remoteApi, api]).size).toBe(2)
  })

  it('keeps only the selected projects, including a worker nested under another project', () => {
    const groups = tree(
      [api, 'api', [row(api, 'api-1'), row(api, 'api-2', [row(web, 'web-worker')])]],
      [web, 'web', [row(web, 'web-1')]]
    )
    const filtered = filterAgentHubTreeByProjects(groups, agentHubPickerProjectKeys([web]))
    expect(filtered[0]?.workspaces.map((workspace) => workspace.rows.map((r) => r.key))).toEqual([
      ['api-2'],
      ['web-1']
    ])
    expect(filtered[0]?.workspaces[0]?.rows[0]?.children.map((child) => child.key)).toEqual([
      'web-worker'
    ])
    expect(filterAgentHubTreeByProjects(groups, new Set())).toEqual(groups)
  })

  it('lists every project once, sorted, with its host label when hosts are mixed', () => {
    const groups = tree(
      [web, 'web', [row(web, 'web-1', [row(remoteApi, 'workhost-worker')])]],
      [api, 'api', [row(api, 'api-1')]]
    )
    const projects = agentHubPickerProjects(
      groups,
      new Map([[getWorktreeHostIdentity(remoteApi), 'workhost']])
    )
    expect(projects.map(({ label, hostLabel }) => [label, hostLabel])).toEqual([
      ['api', null],
      ['repo repo-api', 'workhost'],
      ['web', null]
    ])
  })
})
