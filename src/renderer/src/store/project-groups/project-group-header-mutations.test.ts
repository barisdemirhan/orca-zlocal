import { describe, expect, it, vi } from 'vitest'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import {
  deleteProjectGroupHeader,
  renameProjectGroupHeader,
  setProjectGroupHeaderTabOrder
} from './project-group-header-mutations'
import type { DeleteProjectGroupWithContainedProjectsResult } from '../repos/repo-state'

const REMOTE: ExecutionHostId = 'runtime:env-1'

function group(id: string, executionHostId: ExecutionHostId, name = 'Work'): ProjectGroup {
  return {
    id,
    name,
    parentPath: null,
    executionHostId,
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1
  }
}

const local = group('local', 'local')
const remote = group('remote', REMOTE)
const merged = [local, remote]

function deleted(groupId: string): DeleteProjectGroupWithContainedProjectsResult {
  return {
    status: 'deleted-group',
    groupId,
    requestedProjectIds: [],
    removedProjectIds: [],
    failedProjectRemovals: []
  }
}

function storeFor(
  projectGroups: ProjectGroup[],
  updateProjectGroup = vi.fn(async () => true),
  deleteProjectGroupWithContainedProjects = vi.fn(async (groupId: string) => deleted(groupId))
) {
  return { projectGroups, updateProjectGroup, deleteProjectGroupWithContainedProjects }
}

describe('renaming a header', () => {
  it('renames the group on each host', async () => {
    const store = storeFor(merged)

    await expect(
      renameProjectGroupHeader(store, { groupId: 'local', name: 'New', hostId: 'local' })
    ).resolves.toBe(true)

    expect(store.updateProjectGroup.mock.calls).toEqual([
      ['remote', { name: 'New' }, { hostId: REMOTE }],
      ['local', { name: 'New' }, { hostId: 'local' }]
    ])
  })

  it("leaves this computer's group untouched when the server refuses, so the header stays whole", async () => {
    const store = storeFor(
      merged,
      vi.fn(async () => false)
    )

    await expect(
      renameProjectGroupHeader(store, { groupId: 'local', name: 'New', hostId: 'local' })
    ).resolves.toBe(false)

    expect(store.updateProjectGroup.mock.calls).toEqual([
      ['remote', { name: 'New' }, { hostId: REMOTE }]
    ])
  })

  it('puts the old name back when a later host fails', async () => {
    const update = vi.fn(async (id: string) => id !== 'local')
    const store = storeFor(merged, update as never)

    await expect(
      renameProjectGroupHeader(store, { groupId: 'local', name: 'New', hostId: 'local' })
    ).resolves.toBe(false)

    expect(update.mock.calls.at(-1)).toEqual(['remote', { name: 'Work' }, { hostId: REMOTE }])
  })

  it('makes one call for a group on one host', async () => {
    const store = storeFor([local])

    await renameProjectGroupHeader(store, { groupId: 'local', name: 'New', hostId: 'local' })

    expect(store.updateProjectGroup.mock.calls).toEqual([
      ['local', { name: 'New' }, { hostId: 'local' }]
    ])
  })
})

describe('deleting a header', () => {
  it("deletes each host's group on that host and reports each", async () => {
    const store = storeFor(merged)

    const results = await deleteProjectGroupHeader(store, 'local', {
      removeContainedProjects: false,
      hostId: 'local'
    })

    expect(results.map(({ groupId }) => groupId)).toEqual(['local', 'remote'])
    expect(store.deleteProjectGroupWithContainedProjects.mock.calls).toEqual([
      ['local', { removeContainedProjects: false, hostId: 'local' }],
      ['remote', { removeContainedProjects: false, hostId: REMOTE }]
    ])
  })

  it('keeps going when one host fails, so the reachable one still goes', async () => {
    const remove = vi.fn(async (groupId: string) =>
      groupId === 'remote'
        ? ({
            status: 'group-delete-failed',
            groupId,
            requestedProjectIds: [],
            removedProjectIds: [],
            failedProjectRemovals: []
          } as const)
        : deleted(groupId)
    )
    const store = storeFor([remote, local], undefined, remove as never)

    const results = await deleteProjectGroupHeader(store, 'remote', {
      removeContainedProjects: false
    })

    expect(results.map(({ status }) => status).sort()).toEqual([
      'deleted-group',
      'group-delete-failed'
    ])
  })

  it('passes the caller options through for a group on one host', async () => {
    const store = storeFor([local])
    const options = { removeContainedProjects: true, hostId: 'local' as const }

    await deleteProjectGroupHeader(store, 'local', options)

    expect(store.deleteProjectGroupWithContainedProjects.mock.calls).toEqual([['local', options]])
  })
})

describe('moving a header', () => {
  it('writes the position to every member on its own host', () => {
    const store = storeFor(merged)

    setProjectGroupHeaderTabOrder(store, { groupId: 'local', tabOrder: 5, ownerHostId: 'local' })

    expect(store.updateProjectGroup.mock.calls).toEqual([
      ['local', { tabOrder: 5 }, { hostId: 'local' }],
      ['remote', { tabOrder: 5 }, { hostId: REMOTE }]
    ])
  })

  it('uses the owner host for a group on one host', () => {
    const store = storeFor([remote])

    setProjectGroupHeaderTabOrder(store, { groupId: 'remote', tabOrder: 5, ownerHostId: REMOTE })

    expect(store.updateProjectGroup.mock.calls).toEqual([
      ['remote', { tabOrder: 5 }, { hostId: REMOTE }]
    ])
  })
})
