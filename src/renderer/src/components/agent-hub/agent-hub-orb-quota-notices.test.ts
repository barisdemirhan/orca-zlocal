import { describe, expect, it } from 'vitest'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { makeTab, makeWorktree } from '@/store/slices/store-test-helpers'
import { agentHubOrbQuotaNotices, agentHubOrbQuotaProvider } from './agent-hub-orb-quota-notices'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

const target: AgentHubPaneTarget = {
  worktree: makeWorktree({ id: 'wt', repoId: 'repo' }),
  tab: makeTab({ id: 'tab', worktreeId: 'wt' }),
  repo: null,
  paneKey: null,
  title: 'Selected agent',
  agentType: 'codex'
}
const now = 1_000_000
const snapshot = () =>
  createEmptyRateLimitState({
    codex: {
      provider: 'codex',
      status: 'ok',
      error: null,
      updatedAt: now,
      session: {
        usedPercent: 91,
        windowMinutes: 300,
        resetsAt: now + 600_000,
        resetDescription: null
      },
      weekly: null
    }
  })

describe('opted-in quota risk notices', () => {
  it('deduplicates one shared bucket and escalates only at the next threshold', () => {
    const data = snapshot()
    const notice = agentHubOrbQuotaNotices(target, 'owner-a', data, now)[0]
    expect(notice?.text).toContain('9% remaining')
    expect(notice?.text).toContain('exact account is unverified')
    expect(agentHubOrbQuotaNotices(target, 'owner-a', data, now + 1000)[0]?.id).toBe(notice?.id)
    expect(agentHubOrbQuotaNotices(target, 'owner-b', data, now)[0]?.id).not.toBe(notice?.id)
    if (!data.codex?.session) {
      throw new Error('Missing fixture')
    }
    data.codex.session.usedPercent = 96
    expect(agentHubOrbQuotaNotices(target, 'owner-a', data, now)[0]?.id).not.toBe(notice?.id)
  })
  it('never reports stale, disconnected, malformed, reset, or missing usage as zero quota', () => {
    const data = snapshot()
    expect(agentHubOrbQuotaNotices(target, 'local', data, now + 301_000)).toEqual([])
    if (!data.codex?.session) {
      throw new Error('Missing fixture')
    }
    data.codex.usageMetadata = { unverifiableOwner: true }
    expect(agentHubOrbQuotaNotices(target, 'remote', data, now)).toEqual([])
    delete data.codex.usageMetadata
    data.codex.session.usedPercent = Number.NaN
    expect(agentHubOrbQuotaNotices(target, 'local', data, now)).toEqual([])
    data.codex.session.usedPercent = 100
    data.codex.session.resetsAt = now
    expect(agentHubOrbQuotaNotices(target, 'local', data, now)).toEqual([])
    expect(agentHubOrbQuotaNotices(target, 'local', null, now)).toEqual([])
  })
  it('does not attribute a multi-provider harness or MiMo to an unrelated provider account', () => {
    for (const agentType of ['opencode', 'omp', 'pi', 'mimo-code', 'copilot', 'muse'] as const) {
      expect(agentHubOrbQuotaProvider({ ...target, agentType })).toBeNull()
      expect(agentHubOrbQuotaNotices({ ...target, agentType }, 'local', snapshot(), now)).toEqual(
        []
      )
    }
  })
})
