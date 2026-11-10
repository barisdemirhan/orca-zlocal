import { describe, expect, it } from 'vitest'
import { createTestStore, seedStore } from '@/store/testing/app-store-test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'

const PANE = 'tab-1:leaf-1'
const providerSession = { key: 'session_id' as const, id: 'host-session' }

function runDoneThenWorking(runtimeOwnerEnvironmentId?: string) {
  const store = createTestStore()
  seedStore(store, {
    worktreesByRepo: {
      'repo-1': [
        {
          ...makeWorktree({ id: 'wt-1', repoId: 'repo-1' }),
          ...(runtimeOwnerEnvironmentId ? { runtimeOwnerEnvironmentId } : {})
        }
      ]
    }
  })
  const routing = { tabId: 'tab-1', worktreeId: 'wt-1' }
  const set = (state: 'working' | 'done', at: number, metadata?: object) =>
    store
      .getState()
      .setAgentStatus(
        PANE,
        { state, prompt: 'go', agentType: 'claude' },
        'Claude',
        { updatedAt: at, stateStartedAt: at },
        routing,
        metadata
      )
  set('working', 1, { providerSession })
  set('done', 2)
  set('working', 3)
  return store.getState().agentStatusByPaneKey[PANE]
}

describe('provider session across a new turn', () => {
  it('keeps the host checkpoint on a mirrored row until a host frame replaces it', () => {
    expect(runDoneThenWorking('workhost')?.providerSession).toEqual(providerSession)
  })

  it('still drops the previous turn checkpoint on a local row', () => {
    expect(runDoneThenWorking()?.providerSession).toBeUndefined()
  })
})
