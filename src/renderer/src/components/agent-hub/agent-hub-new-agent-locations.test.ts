import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { makeRepo, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { buildAgentHubNewAgentLocations } from './agent-hub-new-agent-locations'

type LocationState = Parameters<typeof buildAgentHubNewAgentLocations>[0]

const group: ProjectGroup = {
  id: 'notes',
  name: 'Notes',
  parentPath: '/notes',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 0,
  updatedAt: 0
}

function folder(overrides: Partial<FolderWorkspace> = {}): FolderWorkspace {
  return {
    id: 'drafts',
    projectGroupId: 'notes',
    name: 'Drafts',
    folderPath: '/notes/drafts',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function state(overrides: Partial<LocationState> = {}): LocationState {
  return {
    repos: [makeRepo()],
    worktreesByRepo: { 'repo-1': [makeWorktree()] },
    projectGroups: [],
    folderWorkspaces: [],
    deleteStateByWorktreeId: {},
    lastVisitedAtByWorktreeId: {},
    ...overrides
  }
}

describe('new agent locations', () => {
  it('offers only projects with existing non-archived workspaces that are not being removed', () => {
    const worktree = makeWorktree()
    const options = buildAgentHubNewAgentLocations(
      state({
        repos: [makeRepo(), { ...makeRepo(), id: 'empty', path: '/empty', displayName: 'Empty' }],
        worktreesByRepo: {
          'repo-1': [
            worktree,
            { ...worktree, id: 'archived', isArchived: true },
            { ...worktree, id: 'removing', removing: true },
            { ...worktree, id: 'deleting' }
          ],
          empty: [],
          'deleted-project': [{ ...worktree, id: 'orphan', repoId: 'deleted-project' }]
        },
        folderWorkspaces: [folder({ projectGroupId: 'deleted-group' })],
        deleteStateByWorktreeId: {
          deleting: {
            isDeleting: true,
            error: null,
            canForceDelete: false,
            forceDeleteReason: null
          }
        }
      })
    )
    expect(options.map((option) => option.label)).toEqual(['Repo'])
    expect(options[0]?.worktrees.map((row) => row.id)).toEqual(['wt-1'])
  })

  it('lists workspaces by display name and defaults to the most recently visited workspace', () => {
    const worktree = makeWorktree()
    const options = buildAgentHubNewAgentLocations(
      state({
        worktreesByRepo: {
          'repo-1': [
            { ...worktree, id: 'zebra', displayName: 'Zebra', lastActivityAt: 1 },
            { ...worktree, id: 'alpha', displayName: 'Alpha', lastActivityAt: 999 },
            { ...worktree, id: 'beta', displayName: 'Beta', lastActivityAt: 2 }
          ]
        },
        lastVisitedAtByWorktreeId: { zebra: 20, beta: 10 }
      })
    )
    expect(options[0]?.worktrees.map((row) => row.id)).toEqual(['alpha', 'beta', 'zebra'])
    expect(options[0]?.defaultWorktree.id).toBe('zebra')
  })

  it('falls back to activity and then display-name order when no workspace has been visited', () => {
    const worktree = makeWorktree()
    const source = state({
      worktreesByRepo: {
        'repo-1': [
          { ...worktree, id: 'zebra', displayName: 'Zebra', lastActivityAt: 20 },
          { ...worktree, id: 'alpha', displayName: 'Alpha', lastActivityAt: 20 },
          { ...worktree, id: 'older', displayName: 'Aardvark', lastActivityAt: 1 }
        ]
      }
    })
    expect(buildAgentHubNewAgentLocations(source)[0]?.defaultWorktree.id).toBe('alpha')
  })

  it('offers folder-only projects and keeps SSH and paired-runtime ownership on their workspaces', () => {
    const options = buildAgentHubNewAgentLocations(
      state({
        projectGroups: [group],
        folderWorkspaces: [
          folder({ id: 'ssh-drafts', connectionId: 'build-box' }),
          folder({
            id: 'runtime-drafts',
            name: 'Runtime drafts',
            executionHostId: 'runtime:server'
          }),
          folder({ id: 'archived-drafts', isArchived: true })
        ]
      })
    )
    expect(options.map((option) => option.label)).toEqual(['Notes', 'Repo'])
    expect(options[0]?.worktrees).toMatchObject([
      { id: 'folder:ssh-drafts', path: '/notes/drafts', branch: '', hostId: 'ssh:build-box' },
      {
        id: 'folder:runtime-drafts',
        branch: '',
        hostId: 'runtime:server',
        runtimeOwnerEnvironmentId: 'server'
      }
    ])
  })

  it('keeps same-id workspaces on other hosts selectable during a host-scoped deletion', () => {
    const worktree = makeWorktree()
    const options = buildAgentHubNewAgentLocations(
      state({
        worktreesByRepo: {
          'repo-1': [
            { ...worktree, hostId: 'local' },
            { ...worktree, hostId: 'ssh:build-box' },
            { ...worktree, hostId: 'runtime:server', runtimeOwnerEnvironmentId: 'server' }
          ]
        },
        deleteStateByWorktreeId: {
          'local|wt-1': {
            isDeleting: true,
            executionHostId: 'local',
            error: null,
            canForceDelete: false,
            forceDeleteReason: null
          }
        },
        lastVisitedAtByWorktreeId: { 'ssh:build-box|wt-1': 10, 'runtime:server|wt-1': 20 }
      })
    )
    expect(options[0]?.worktrees.map((row) => row.hostId)).toEqual([
      'ssh:build-box',
      'runtime:server'
    ])
    expect(options[0]?.defaultWorktree.hostId).toBe('runtime:server')
  })
})
