import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from './rpc/dispatcher'
import { TERMINAL_METHODS } from './rpc/methods/terminal/terminal'
import type { RuntimeStore } from './runtime-store-contract'
import { makeAgentStatusStoreWiring } from './agent-status-store-wiring.test-fixture'
import { parseWorkspaceSession } from '../../shared/workspace-session/workspace-session-schema'

// Preserve side-effect order: mocks, lifecycle, fixtures.
await import('./orca-runtime-tests/runtime-test-module-registration.spec')
const { OrcaRuntimeService } = await import('./orca-runtime')
const { computeWorktreePathMock, ensurePathWithinWorkspaceMock } =
  await import('./orca-runtime-test-mocks/setup.spec')
const { listWorktrees } = await import('../git/worktrees/catalog/worktree-scan-cache')
await import('./orca-runtime-tests/orca-runtime-test-lifecycle.spec')
const {
  TEST_WORKTREE_ID,
  makeRuntimeStoreWithWorkspaceSession,
  makeWorkspaceSessionWithHeadlessTerminal
} = await import('./orca-runtime-tests/orca-runtime-test-fixtures.spec')

/** The created terminal with the pane identity these assertions rely on. */
function created<T extends { paneKey?: string | null; tabId?: string }>(
  terminal: T
): T & { paneKey: string; tabId: string } {
  const { paneKey, tabId } = terminal
  if (!paneKey || !tabId) {
    throw new Error('Created terminal has no pane identity')
  }
  return { ...terminal, paneKey, tabId }
}

function setup() {
  const fixture = makeRuntimeStoreWithWorkspaceSession(makeWorkspaceSessionWithHeadlessTerminal())
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The shared store fixture implements RuntimeStore; legacy vi.Mock signatures erase its callable types.
  const store = fixture.runtimeStore as RuntimeStore
  const wiring = makeAgentStatusStoreWiring()
  let sequence = 0
  const spawn = vi.fn(async () => ({ id: `spawn-${++sequence}` }))
  function start() {
    const runtime = new OrcaRuntimeService(store, undefined, wiring.deps)
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    return runtime
  }
  return { ...fixture, wiring, start, runtime: start() }
}

describe('host pane creator lineage', () => {
  it('prunes lineage when an orphaned worktree is forgotten without individual terminal closes', async () => {
    const f = setup()
    const parent = created(await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`))
    const child = created(
      await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
        callerTerminalHandle: parent.handle
      })
    )
    vi.spyOn(f.runtimeStore, 'getRepos').mockReturnValue([])
    vi.spyOn(f.runtimeStore, 'getRepo').mockReturnValue(undefined)
    await f.runtime.removeManagedWorktree(TEST_WORKTREE_ID)
    expect(f.runtime.getTerminalSpawnedBy(child.paneKey)).toBeUndefined()
    expect(f.getSession().terminalSpawnedByPaneKey).toEqual({})
  })

  it('records RPC create/split callers on the execution host and gives orchestration parentage priority', async () => {
    const f = setup()
    const parent = await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`)
    const dispatcher = new RpcDispatcher({ runtime: f.runtime, methods: TERMINAL_METHODS })
    const leafId = '44444444-4444-4444-8444-444444444444'
    const childPane = `rpc-child:${leafId}`
    const response = await dispatcher.dispatch({
      id: 'create-child',
      authToken: 'test',
      method: 'terminal.create',
      params: {
        worktree: `id:${TEST_WORKTREE_ID}`,
        tabId: 'rpc-child',
        leafId,
        callerTerminalHandle: parent.handle
      }
    })
    expect(response).toMatchObject({ ok: true })
    expect(f.runtime.getTerminalSpawnedBy(childPane)).toEqual({ paneKey: parent.paneKey })
    const childHandle = f.runtime.getTerminalHandleForPaneKey(childPane)
    if (!childHandle) {
      throw new Error('No child handle')
    }
    const splitResponse = await dispatcher.dispatch({
      id: 'split-child',
      authToken: 'test',
      method: 'terminal.split',
      params: { terminal: childHandle, callerTerminalHandle: childHandle }
    })
    expect(splitResponse).toMatchObject({ ok: true })
    expect(
      Object.values(f.getSession().terminalSpawnedByPaneKey ?? {}).some(
        (link) => link.paneKey === childPane
      )
    ).toBe(true)
    expect(f.runtime.getAgentHubParentPaneKey(childPane)).toBe(parent.paneKey)
    vi.spyOn(f.runtime, 'getAgentStatusOrchestrationContextForPaneKey').mockReturnValue({
      taskId: 'task',
      dispatchId: 'dispatch',
      parentPaneKey: 'orchestration-parent'
    })
    expect(f.runtime.getAgentHubParentPaneKey(childPane)).toBe('orchestration-parent')
  })

  it('records create and split from live callers, carries status, restores after handle remint, and prunes on parent close', async () => {
    const f = setup()
    const parent = created(await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`))
    const child = created(
      await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
        callerTerminalHandle: parent.handle
      })
    )
    const grandchild = await f.runtime.splitTerminal(child.handle, {
      callerTerminalHandle: child.handle
    })
    expect(f.getSession().terminalSpawnedByPaneKey).toEqual({
      [child.paneKey]: { paneKey: parent.paneKey },
      [`${grandchild.tabId}:${grandchild.leafId}`]: { paneKey: child.paneKey }
    })
    f.wiring.statusStore.ingestTerminalStatus({
      paneKey: child.paneKey,
      payload: { state: 'working', prompt: 'child', agentType: 'codex' },
      connectionId: null
    })
    expect(f.wiring.statusStore.getStatusSnapshotForPane(child.paneKey)[0]).toMatchObject({
      spawnedBy: { paneKey: parent.paneKey }
    })
    expect(f.runtime.getAgentHubParentPaneKey(`${grandchild.tabId}:${grandchild.leafId}`)).toBe(
      child.paneKey
    )

    const parsed = parseWorkspaceSession(JSON.parse(JSON.stringify(f.getSession())))
    if (!parsed.ok) {
      throw new Error('Session failed validation')
    }
    f.setSession(parsed.value)
    const restarted = f.start()
    const restoredParent = await restarted.createTerminal(`id:${TEST_WORKTREE_ID}`, {
      tabId: parent.tabId,
      leafId: parent.paneKey.slice(parent.tabId.length + 1)
    })
    expect(restoredParent.handle).not.toBe(parent.handle)
    expect(restarted.getTerminalSpawnedBy(child.paneKey)).toEqual({ paneKey: parent.paneKey })
    await restarted.closeTerminalSurfaceFromRenderer({
      worktreeId: TEST_WORKTREE_ID,
      target: { kind: 'tab', tabId: parent.tabId },
      reason: 'user'
    })
    expect(restarted.getTerminalSpawnedBy(child.paneKey)).toBeUndefined()
    expect(f.getSession().terminalSpawnedByPaneKey?.[child.paneKey]).toBeUndefined()
    expect(
      f.wiring.statusStore.getStatusSnapshotForPane(child.paneKey)[0]?.spawnedBy
    ).toBeUndefined()
    expect(restarted.getTerminalSpawnedBy(`${grandchild.tabId}:${grandchild.leafId}`)).toEqual({
      paneKey: child.paneKey
    })
  })

  it('ignores foreign, unknown and exited caller handles, and removes both sides of a closed child pane', async () => {
    const f = setup()
    const parent = await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`)
    for (const callerTerminalHandle of ['term-foreign', 'unknown']) {
      const child = created(
        await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, { callerTerminalHandle })
      )
      expect(f.runtime.getTerminalSpawnedBy(child.paneKey)).toBeUndefined()
    }
    if (!parent.ptyId) {
      throw new Error('Parent terminal has no PTY')
    }
    f.runtime.onPtyExit(parent.ptyId, 0)
    const orphan = created(
      await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
        callerTerminalHandle: parent.handle
      })
    )
    expect(f.runtime.getTerminalSpawnedBy(orphan.paneKey)).toBeUndefined()
    const live = await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`)
    const child = await f.runtime.splitTerminal(live.handle, { callerTerminalHandle: live.handle })
    const { tabId: childTab, leafId: childLeaf } = child
    if (!childTab || !childLeaf) {
      throw new Error('Split pane has no pane identity')
    }
    const childPane = `${childTab}:${childLeaf}`
    const grandchild = created(
      await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
        callerTerminalHandle: child.handle
      })
    )
    await f.runtime.closeTerminalSurfaceFromRenderer({
      worktreeId: TEST_WORKTREE_ID,
      target: { kind: 'pane', tabId: childTab, leafId: childLeaf },
      reason: 'user'
    })
    expect(f.runtime.getTerminalSpawnedBy(childPane)).toBeUndefined()
    expect(f.runtime.getTerminalSpawnedBy(grandchild.paneKey)).toBeUndefined()
  })

  it('links worktree create startup agents to the caller pane across workspace boundaries', async () => {
    const f = setup()
    const parent = await f.runtime.createTerminal(`id:${TEST_WORKTREE_ID}`)
    const path = '/tmp/workspaces/spawned-startup'
    computeWorktreePathMock.mockReturnValue(path)
    ensurePathWithinWorkspaceMock.mockReturnValue(path)
    vi.mocked(listWorktrees).mockResolvedValue([
      { path, head: 'abc', branch: 'spawned-startup', isBare: false, isMainWorktree: false }
    ])
    const result = await f.runtime.createManagedWorktree({
      repoSelector: 'id:repo-1',
      name: 'spawned-startup',
      startupAgent: 'claude',
      startupPrompt: 'hello',
      activate: false,
      lineage: { callerTerminalHandle: parent.handle }
    })
    expect(result.startupTerminal?.spawned).toBe(true)
    expect(f.runtime.getTerminalSpawnedBy(result.startupTerminal?.paneKey ?? '')).toEqual({
      paneKey: parent.paneKey
    })
  })
})
