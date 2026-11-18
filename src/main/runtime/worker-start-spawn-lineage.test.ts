import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPendingWorkerLaunchReceipt } from './rpc/methods/orchestration/worker/start/launch/worker-launch-preferences'
import type { RuntimeStore } from './construction/runtime-store-contract'
import type { OrchestrationDb } from './orchestration/db/orchestration-db'
import { makeAgentStatusStoreWiring } from './terminal/identity/agent-status-store-wiring.test-fixture'
import { setStructuredAgentSessionHost } from '../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { structuredWorkerIdentities } from './orchestration/terminal-authority/structured-sessions/structured-worker-identity'
import { placeWorkerAgent } from './rpc/methods/orchestration/worker/start/placement/worker-start-agent-placement'
import { makeStructuredAgentStatusSubject } from '../../shared/agent-status/contracts/agent-status-subject'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/agent-session/view/structured-agent-session-projection'

// Preserve side-effect order: mocks, lifecycle, fixtures.
await import('./orca-runtime-tests/runtime-test-module-registration.spec')
const { OrcaRuntimeService } = await import('./orca-runtime')
await import('./orca-runtime-tests/orca-runtime-test-lifecycle.spec')
const {
  TEST_WORKTREE_ID,
  makeRuntimeStoreWithWorkspaceSession,
  makeWorkspaceSessionWithHeadlessTerminal
} = await import('./orca-runtime-tests/orca-runtime-test-fixtures.spec')

vi.mock('./rpc/methods/structured-sessions/creation/structured-agent-session-create', () => ({
  createStructuredAgentSessionForWorktree: async (args: { envelope: { sessionId: string } }) => ({
    ok: true,
    value: { sessionId: args.envelope.sessionId, fence: 7 }
  })
}))

afterEach(() => {
  structuredWorkerIdentities.clear()
  setStructuredAgentSessionHost(null)
})

describe('worker-start spawn lineage', () => {
  it.each(['caller', undefined, 'foreign'] as const)(
    'publishes lineage only for a live Orca caller (%s)',
    async (caller) => {
      const fixture = makeRuntimeStoreWithWorkspaceSession(
        makeWorkspaceSessionWithHeadlessTerminal()
      )
      const wiring = makeAgentStatusStoreWiring()
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the shared runtime-store fixture implements RuntimeStore.
      const store = fixture.runtimeStore as RuntimeStore
      const runtime = new OrcaRuntimeService(store, undefined, wiring.deps)
      runtime.setPtyController({
        spawn: async () => ({ id: 'parent-pty' }),
        write: () => true,
        kill: () => true,
        getForegroundProcess: async () => null
      })
      const parent = await runtime.createTerminal(`id:${TEST_WORKTREE_ID}`)
      if (!parent.paneKey || !parent.tabId) {
        throw new Error('Parent has no pane')
      }
      vi.spyOn(runtime, 'ensureStructuredAgentSessionHost').mockResolvedValue(undefined)
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: worker creation reads only the installed host's subscription and record location.
      setStructuredAgentSessionHost({
        subscribe: () => () => {},
        deps: {
          store: {
            requireWritableRecord: () => ({
              location: { executionHostId: 'local', wslDistro: null }
            })
          }
        }
      } as never)
      const placed = await placeWorkerAgent({
        runtime,
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: placement only writes worker-stage rows through this database fixture.
        db: { recordWorkerStage: vi.fn() } as unknown as OrchestrationDb,
        dispatchId: 'ctx_lineage',
        taskId: 'task_lineage',
        params: {
          from: parent.handle,
          task: 'task_lineage',
          ...(caller ? { callerTerminalHandle: caller === 'caller' ? parent.handle : caller } : {})
        },
        requestedWorktree: `id:${TEST_WORKTREE_ID}`,
        creationTarget: undefined,
        resolvedWorktree: { id: TEST_WORKTREE_ID, repoId: 'repo-1' },
        mode: {
          mode: 'structured',
          preferred: 'structured',
          reason: 'user_default',
          detail: 'structured worker'
        },
        agent: 'codex',
        launch: {
          preferences: undefined,
          receipt: createPendingWorkerLaunchReceipt({ agent: 'codex' })
        },
        effects: [],
        onStage: () => {}
      })
      const sessionId = placed.structuredSession?.identity.sessionId
      if (!sessionId) {
        throw new Error('No structured worker')
      }
      const childPane = structuredAgentSessionPaneKey(
        structuredAgentSessionTabId(sessionId),
        sessionId
      )
      const expectedParent = caller === 'caller' ? { paneKey: parent.paneKey } : undefined
      expect(fixture.getSession().terminalSpawnedByPaneKey?.[childPane]).toEqual(expectedParent)
      expect(runtime.getTerminalSpawnedBy(childPane)).toEqual(expectedParent)
      expect(
        runtime.getTerminalSpawnedBy(placed.structuredSession?.identity.paneKey ?? '')
      ).toBeUndefined()

      const now = Date.now()
      wiring.statusStore.ingestTerminalStatus({
        paneKey: parent.paneKey,
        worktreeId: TEST_WORKTREE_ID,
        payload: { state: 'working', prompt: 'coordinate', agentType: 'claude' }
      })
      const location = {
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: TEST_WORKTREE_ID,
        workspaceKind: 'git-worktree'
      } as const
      wiring.statusStore.ingestStructuredStatus(
        {
          sessionId,
          workspaceId: TEST_WORKTREE_ID,
          agent: 'codex',
          status: 'working',
          hostExecutionOwned: true,
          latestPrompt: 'worker',
          model: 'gpt-6.1-sol',
          updatedAt: now
        },
        makeStructuredAgentStatusSubject(location, sessionId)
      )
      expect(wiring.statusStore.getStatusSnapshotForPane(childPane)[0]?.spawnedBy).toEqual(
        expectedParent
      )
    }
  )
})
