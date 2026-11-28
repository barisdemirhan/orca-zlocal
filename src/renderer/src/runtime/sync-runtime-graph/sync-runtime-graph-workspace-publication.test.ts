import { describe, expect, it } from 'vitest'
import { buildMobileSessionTabSnapshots } from './mobile-session-snapshots'
import { makeState } from './testing/sync-runtime-graph-test-harness'

describe('buildMobileSessionTabSnapshots', () => {
  it('keeps the private Peek workspace out of mobile and paired session publication', () => {
    const state = makeState({
      groupsByWorktree: { 'agent-hub-peek': [], 'visible-workspace': [] },
      unifiedTabsByWorktree: { 'agent-hub-peek': [] },
      browserTabsByWorktree: { 'agent-hub-peek': [] }
    })
    expect(buildMobileSessionTabSnapshots(state).map((snapshot) => snapshot.worktree)).toEqual([
      'visible-workspace'
    ])
  })
})
