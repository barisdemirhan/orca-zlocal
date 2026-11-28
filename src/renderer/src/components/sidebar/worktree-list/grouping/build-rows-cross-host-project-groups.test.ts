import { describe, expect, it } from 'vitest'
import { buildRows } from './build-rows.test-fixture'
import { worktree } from './worktree-list-groups-test-fixtures'
import { getProjectGroupHeaderKey } from '../../../../../../shared/sidebar-list/sections/group-keys'
import type { Row } from '../../../../../../shared/sidebar-list/row-types'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'

const RUNTIME_HOST = 'runtime:env-1' as const

function makeGroup(overrides: Partial<ProjectGroup> & Pick<ProjectGroup, 'id'>): ProjectGroup {
  return {
    name: 'ai',
    parentPath: null,
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

const localAi = makeGroup({ id: 'local-ai', executionHostId: 'local' })
const remoteAi = makeGroup({
  id: 'remote-ai',
  executionHostId: RUNTIME_HOST,
  tabOrder: 1,
  createdAt: 2
})
const remoteSkills = makeGroup({
  id: 'remote-skills',
  name: 'skills',
  parentGroupId: 'remote-ai',
  executionHostId: RUNTIME_HOST,
  tabOrder: 2
})

const localRepo: Repo = {
  id: 'repo-local',
  path: '/Users/me/orca',
  displayName: 'orca',
  badgeColor: '#000000',
  addedAt: 0,
  executionHostId: 'local',
  projectGroupId: localAi.id
}
const remoteRepo: Repo = {
  id: 'repo-remote',
  path: '/home/me/trading',
  displayName: 'trading',
  badgeColor: '#111111',
  addedAt: 1,
  executionHostId: RUNTIME_HOST,
  projectGroupId: remoteAi.id
}
const remoteSkillRepo: Repo = {
  id: 'repo-remote-skill',
  path: '/home/me/vault',
  displayName: 'vault',
  badgeColor: '#222222',
  addedAt: 2,
  executionHostId: RUNTIME_HOST,
  projectGroupId: remoteSkills.id
}

function mainWorktree(repo: Repo): Worktree {
  return {
    ...worktree,
    id: `${repo.id}::main`,
    repoId: repo.id,
    path: repo.path,
    branch: 'refs/heads/main',
    isMainWorktree: true,
    displayName: 'main'
  }
}

function rowsFor(options: {
  groups: readonly ProjectGroup[]
  repos: readonly Repo[]
  collapsed?: Set<string>
}): string[] {
  const rows: Row[] = buildRows(
    'repo',
    options.repos.map(mainWorktree),
    new Map(options.repos.map((repo) => [repo.id, repo])),
    null,
    options.collapsed ?? new Set<string>(),
    undefined,
    undefined,
    'manual',
    {},
    undefined,
    false,
    undefined,
    options.groups
  )
  return rows.flatMap((row) => {
    if (row.type === 'header') {
      return [
        `${row.projectGroup ? 'group' : 'project'}:${row.label}@${row.projectGroupDepth ?? 0}`
      ]
    }
    return row.type === 'item' ? [`item:${row.worktree.repoId}`] : []
  })
}

describe('sidebar rows with same-named project groups on two hosts', () => {
  it("draws one header holding both hosts' projects", () => {
    expect(rowsFor({ groups: [localAi, remoteAi], repos: [localRepo, remoteRepo] })).toEqual([
      'group:ai@0',
      'project:orca@1',
      'item:repo-local',
      'project:trading@1',
      'item:repo-remote'
    ])
  })

  it("collapses both hosts' projects under the single header key", () => {
    expect(
      rowsFor({
        groups: [localAi, remoteAi],
        repos: [localRepo, remoteRepo],
        collapsed: new Set([getProjectGroupHeaderKey(localAi.id)])
      })
    ).toEqual(['group:ai@0'])
  })

  it('nests a child group from one host under the merged parent', () => {
    expect(
      rowsFor({
        groups: [localAi, remoteAi, remoteSkills],
        repos: [localRepo, remoteRepo, remoteSkillRepo]
      })
    ).toEqual([
      'group:ai@0',
      'project:orca@1',
      'item:repo-local',
      'project:trading@1',
      'item:repo-remote',
      'group:skills@1',
      'project:vault@2',
      'item:repo-remote-skill'
    ])
  })

  it('keeps separate headers when the names differ', () => {
    expect(
      rowsFor({
        groups: [localAi, { ...remoteAi, name: 'server' }],
        repos: [localRepo, remoteRepo]
      })
    ).toEqual([
      'group:ai@0',
      'project:orca@1',
      'item:repo-local',
      'group:server@0',
      'project:trading@1',
      'item:repo-remote'
    ])
  })

  it('keeps the header and its local projects while the server is unknown', () => {
    expect(rowsFor({ groups: [localAi], repos: [localRepo] })).toEqual([
      'group:ai@0',
      'project:orca@1',
      'item:repo-local'
    ])
  })
})
