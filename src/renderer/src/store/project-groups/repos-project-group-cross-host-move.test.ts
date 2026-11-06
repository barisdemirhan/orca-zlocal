/**
 * A project always joins a group saved on its own host; hosts store any other group id as
 * "no group" and still return the row (#13699). So a move aimed at another host's group goes to
 * the same-named group on the project's host, created there when missing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/rpc/testing/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCache as clearRuntimeCompatibilityCacheForTests } from '../../runtime/rpc/compatibility/runtime-compatibility-cache'
import { createTestStore } from '../testing/app-store-test-fixture'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REMOTE_HOST: ExecutionHostId = 'runtime:env-b'

const remoteRepo: Repo = {
  id: 'remote-only',
  path: '/srv/remote-only',
  displayName: 'remote-only',
  badgeColor: '#111',
  addedAt: 1,
  executionHostId: REMOTE_HOST,
  projectGroupId: null
}

const localRepo: Repo = {
  id: 'local-only',
  path: '/Users/me/local-only',
  displayName: 'local-only',
  badgeColor: '#222',
  addedAt: 2,
  executionHostId: 'local',
  projectGroupId: null
}

function group(
  id: string,
  executionHostId: ExecutionHostId,
  overrides: Partial<ProjectGroup> = {}
): ProjectGroup {
  return {
    id,
    name: 'Work',
    parentPath: null,
    executionHostId,
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

const listLocal = vi.fn()
const createLocal = vi.fn()
const moveProject = vi.fn()
const runtimeCall = vi.fn<(request: RuntimeEnvironmentCallRequest) => Promise<unknown>>()

function ok(result: unknown): unknown {
  return { id: 'rpc', ok: true, result, _meta: { runtimeId: 'runtime-b' } }
}

/** A fake paired server: remembers created groups and answers moves with the row it stored. */
function serveRemoteHost(initialGroups: ProjectGroup[] = []): void {
  const groups = [...initialGroups]
  let createdCount = 0
  runtimeCall.mockImplementation(async (request) => {
    const params = request.params as Record<string, unknown>
    if (request.method === 'projectGroup.list') {
      return ok({ groups })
    }
    if (request.method === 'projectGroup.create') {
      createdCount += 1
      const created = group(`created-${createdCount}`, REMOTE_HOST, {
        name: params.name as string,
        parentGroupId: (params.parentGroupId as string | undefined) ?? null,
        createdAt: 100 + createdCount
      })
      groups.push(created)
      return ok({ group: created })
    }
    if (request.method === 'projectGroup.moveProject') {
      return ok({ repo: { ...remoteRepo, projectGroupId: params.groupId } })
    }
    throw new Error(`unexpected ${request.method}`)
  })
}

function callsOf(method: string): Record<string, unknown>[] {
  return runtimeCall.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === method)
    .map((request) => request.params as Record<string, unknown>)
}

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  vi.mocked(toast.error).mockReset()
  listLocal.mockReset()
  createLocal.mockReset()
  moveProject.mockReset()
  runtimeCall.mockReset()
  vi.stubGlobal('window', {
    api: {
      projectGroups: { list: listLocal, create: createLocal, moveProject },
      runtimeEnvironments: {
        call: (request: RuntimeEnvironmentCallRequest) =>
          createCompatibleRuntimeStatusResponseIfNeeded(request) ?? runtimeCall(request)
      }
    }
  })
})

function storeWith(projectGroups: ProjectGroup[], repos: Repo[] = [remoteRepo]) {
  const store = createTestStore()
  store.setState({ repos, projectGroups })
  return store
}

describe('moving a project into a group on another host', () => {
  it("creates the group on the project's host and joins it", async () => {
    serveRemoteHost()
    const store = storeWith([group('local-work', 'local')])

    await expect(store.getState().moveProjectToGroup(remoteRepo, 'local-work')).resolves.toBe(true)

    expect(callsOf('projectGroup.create')).toEqual([{ name: 'Work', createdFrom: 'manual' }])
    expect(callsOf('projectGroup.moveProject')).toEqual([
      { repo: remoteRepo.id, groupId: 'created-1', connectionId: null }
    ])
    expect(store.getState().repos[0]?.projectGroupId).toBe('created-1')
    expect(store.getState().projectGroups.map((entry) => entry.id)).toEqual([
      'local-work',
      'created-1'
    ])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('creates the group on this computer for a local project sent to a remote header', async () => {
    listLocal.mockResolvedValue([])
    createLocal.mockResolvedValue(group('new-local', 'local'))
    moveProject.mockResolvedValue({ ...localRepo, projectGroupId: 'new-local' })
    const store = storeWith([group('remote-work', REMOTE_HOST)], [localRepo])

    await expect(store.getState().moveProjectToGroup(localRepo, 'remote-work')).resolves.toBe(true)

    expect(createLocal).toHaveBeenCalledWith({ name: 'Work', createdFrom: 'manual' })
    expect(moveProject).toHaveBeenCalledWith({
      projectId: localRepo.id,
      groupId: 'new-local',
      order: undefined,
      hostId: 'local'
    })
  })

  it("uses the header's existing member on the project's host without creating one", async () => {
    serveRemoteHost()
    const store = storeWith([group('local-work', 'local'), group('remote-work', REMOTE_HOST)])

    await expect(store.getState().moveProjectToGroup(remoteRepo, 'local-work')).resolves.toBe(true)

    expect(callsOf('projectGroup.create')).toEqual([])
    expect(callsOf('projectGroup.moveProject')[0]?.groupId).toBe('remote-work')
  })

  it('joins a same-named group the other host made since the last read', async () => {
    serveRemoteHost([group('made-elsewhere', REMOTE_HOST, { name: 'work' })])
    const store = storeWith([group('local-work', 'local')])

    await expect(store.getState().moveProjectToGroup(remoteRepo, 'local-work')).resolves.toBe(true)

    expect(callsOf('projectGroup.create')).toEqual([])
    expect(callsOf('projectGroup.moveProject')[0]?.groupId).toBe('made-elsewhere')
  })

  it("rebuilds a nested group's parents on the project's host, top down", async () => {
    serveRemoteHost()
    const store = storeWith([
      group('local-top', 'local', { name: 'Top' }),
      group('local-nested', 'local', { name: 'Nested', parentGroupId: 'local-top' })
    ])

    await expect(store.getState().moveProjectToGroup(remoteRepo, 'local-nested')).resolves.toBe(
      true
    )

    expect(callsOf('projectGroup.create')).toEqual([
      { name: 'Top', createdFrom: 'manual' },
      { name: 'Nested', createdFrom: 'manual', parentGroupId: 'created-1' }
    ])
    expect(callsOf('projectGroup.moveProject')[0]?.groupId).toBe('created-2')
  })

  it('creates one group when two moves overlap', async () => {
    serveRemoteHost()
    const secondRepo: Repo = { ...remoteRepo, id: 'remote-second', path: '/srv/remote-second' }
    const store = storeWith([group('local-work', 'local')], [remoteRepo, secondRepo])

    await Promise.all([
      store.getState().moveProjectToGroup(remoteRepo, 'local-work'),
      store.getState().moveProjectToGroup(secondRepo, 'local-work')
    ])

    expect(callsOf('projectGroup.moveProject').map((params) => params.groupId)).toEqual([
      'created-1',
      'created-1'
    ])
  })
})
