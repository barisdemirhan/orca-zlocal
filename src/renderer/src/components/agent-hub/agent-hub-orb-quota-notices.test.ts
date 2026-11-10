import { describe, expect, it } from 'vitest'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { makeTab } from '@/store/terminals/terminal-tab.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import {
  agentHubOrbQuotaNotices,
  agentHubOrbQuotaProvider,
  collectAgentHubOrbQuotaAlerts
} from './agent-hub-orb-quota-notices'
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
const alerts = (
  owner: string,
  limits: ReturnType<typeof createEmptyRateLimitState> | null,
  at = now,
  agents = [target]
) =>
  collectAgentHubOrbQuotaAlerts(
    agents.map((entry) => ({ target: entry, owner, limits })),
    at
  )
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
  it('reports one shared account window once and re-delivers only when it runs out', () => {
    const data = snapshot()
    const [alert] = alerts('owner-a', data, now, [target, { ...target, title: 'Second agent' }])
    expect(alert?.agents).toBe(2)
    const [notice] = alert ? agentHubOrbQuotaNotices(alert, now) : []
    expect(notice?.text).toContain('10% or less left')
    expect(notice?.text).toContain('2 agents use it')
    expect(alerts('owner-b', data)[0]?.id).not.toBe(alert?.id)
    if (!data.codex?.session) {
      throw new Error('Missing fixture')
    }
    data.codex.session.usedPercent = 96
    const [lower] = alerts('owner-a', data)
    expect(lower && agentHubOrbQuotaNotices(lower, now)[0]?.id).toBe(notice?.id)
    data.codex.session.usedPercent = 100
    const [empty] = alerts('owner-a', data)
    const emptyNotice = empty ? agentHubOrbQuotaNotices(empty, now)[0] : undefined
    expect(emptyNotice?.id).not.toBe(notice?.id)
    expect(emptyNotice?.text).toContain('0% left (limit reached)')
  })
  it('never reports stale, disconnected, malformed, reset, or missing usage as zero quota', () => {
    const data = snapshot()
    expect(alerts('local', data, now + 301_000)).toEqual([])
    if (!data.codex?.session) {
      throw new Error('Missing fixture')
    }
    data.codex.usageMetadata = { unverifiableOwner: true }
    expect(alerts('remote', data)).toEqual([])
    delete data.codex.usageMetadata
    data.codex.session.usedPercent = Number.NaN
    expect(alerts('local', data)).toEqual([])
    data.codex.session.usedPercent = 100
    data.codex.session.resetsAt = now
    expect(alerts('local', data)).toEqual([])
    expect(alerts('local', null)).toEqual([])
  })
  it('does not attribute a multi-provider harness or MiMo to an unrelated provider account', () => {
    for (const agentType of ['opencode', 'omp', 'pi', 'mimo-code', 'copilot', 'muse'] as const) {
      expect(agentHubOrbQuotaProvider({ ...target, agentType })).toBeNull()
      expect(alerts('local', snapshot(), now, [{ ...target, agentType }])).toEqual([])
    }
  })
})
