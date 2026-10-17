import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer } from './server'
import { installHookStatusSessionTabsRepublish } from './hook-status-session-tabs-republish'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../shared/agent-status-types'
import { AgentHubLedger } from '../runtime/agent-hub/agent-hub-ledger'
import {
  createMobileSessionTabsAgentStatusHeartbeat,
  SESSION_TABS_AGENT_STATUS_HEARTBEAT_INTERVAL_MS
} from '../runtime/mobile-session-tabs-agent-status-heartbeat'

const PANE = 'tab-provider:11111111-1111-4111-8111-111111111111'

function providerOnly(server: AgentHookServer, transcriptPath: string): void {
  server.ingestRemote(
    {
      paneKey: PANE,
      tabId: 'tab-provider',
      worktreeId: 'repo::/worktree',
      providerSession: { key: 'session_id', id: 'pi-session', transcriptPath },
      providerSessionOnly: true,
      payload: { state: 'done', prompt: '', agentType: 'pi' }
    },
    null
  )
}

describe('hook status session-tabs republish', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['blocked', 'waiting'] as const)(
    'keeps the progress line while the agent is %s mid-turn',
    (state) => {
      const server = new AgentHookServer()
      const agentHub = new AgentHubLedger(() => {})
      agentHub.registerDesktop('desktop')
      const uninstall = installHookStatusSessionTabsRepublish(server, () => ({
        agentHub,
        getTerminalWorktreeIdForHandle: () => null,
        getTerminalWorktreeIdForPaneKey: () => null,
        scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree: vi.fn(),
        touchMobileSessionTabsForWorktree: vi.fn()
      }))
      const report = (status: 'working' | typeof state): void =>
        server.ingestTerminalStatus({
          paneKey: PANE,
          tabId: 'tab-provider',
          worktreeId: 'repo::/worktree',
          payload: { state: status, prompt: 'Building', agentType: 'codex' }
        })
      try {
        report('working')
        const caller = { paneKey: PANE, terminalHandle: 'term-worker' }
        agentHub.updateProgress(caller, caller, 'Building')
        report(state)
        expect(agentHub.snapshot().progress).toHaveLength(1)
      } finally {
        uninstall()
        agentHub.dispose()
        server.stop()
      }
    }
  )

  it.each(['working', 'blocked', 'waiting'] as const)(
    'clears only the pane progress when its turn ends after %s',
    async (state) => {
      vi.useFakeTimers()
      vi.setSystemTime(1_000)
      const server = new AgentHookServer()
      const events: unknown[] = []
      const agentHub = new AgentHubLedger((event) => events.push(event))
      agentHub.registerDesktop('desktop')
      const runtime = {
        agentHub,
        getTerminalWorktreeIdForHandle: () => null,
        getTerminalWorktreeIdForPaneKey: () => null,
        scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree: vi.fn(),
        touchMobileSessionTabsForWorktree: vi.fn()
      }
      const uninstall = installHookStatusSessionTabsRepublish(server, () => runtime)
      const caller = { paneKey: PANE, terminalHandle: 'term-worker' }
      const other = { paneKey: 'other-pane', terminalHandle: 'term-other' }
      const report = (status: 'working' | 'blocked' | 'waiting' | 'done', prompt: string): void =>
        server.ingestTerminalStatus({
          paneKey: PANE,
          tabId: 'tab-provider',
          worktreeId: 'repo::/worktree',
          payload: { state: status, prompt, agentType: 'codex' }
        })
      try {
        report('working', 'Building')
        agentHub.updateProgress(caller, caller, 'Building')
        agentHub.updateProgress(other, other, 'Other work')
        report('working', 'Testing')
        expect(agentHub.snapshot().progress).toHaveLength(2)
        report(state, 'Finishing')
        report('done', '')
        expect(agentHub.snapshot().progress.map((line) => line.target.paneKey)).toEqual([
          other.paneKey
        ])
        await vi.advanceTimersByTimeAsync(1_000)
        expect(events.at(-1)).toMatchObject({ kind: 'progress', target: caller, text: null })
        report('working', 'Next turn')
        agentHub.updateProgress(caller, caller, 'Next turn')
        server.retirePaneAuthority(PANE)
        expect(agentHub.snapshot().progress).toHaveLength(2)
        report('working', 'Still working')
        uninstall()
        report('done', '')
        expect(agentHub.snapshot().progress).toHaveLength(2)
      } finally {
        uninstall()
        agentHub.dispose()
        server.stop()
      }
    }
  )

  it('delivers provider-only changes and authority retirement from the owner mutation stream', () => {
    const server = new AgentHookServer()
    const touch = vi.fn()
    const uninstall = installHookStatusSessionTabsRepublish(server, () => ({
      getTerminalWorktreeIdForHandle: () => null,
      getTerminalWorktreeIdForPaneKey: () => null,
      scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree: vi.fn(),
      touchMobileSessionTabsForWorktree: touch
    }))
    try {
      providerOnly(server, '/sessions/first.jsonl')
      expect(touch).toHaveBeenLastCalledWith('repo::/worktree')

      touch.mockClear()
      providerOnly(server, '/sessions/first.jsonl')
      expect(touch).not.toHaveBeenCalled()

      providerOnly(server, '/sessions/replaced.jsonl')
      expect(touch).toHaveBeenCalledTimes(1)

      touch.mockClear()
      server.retirePaneAuthority(PANE)
      expect(touch).toHaveBeenCalledTimes(1)
      expect(touch).toHaveBeenCalledWith('repo::/worktree')
    } finally {
      uninstall()
    }
  })

  it('deduplicates the old and new ownership of one moved row', () => {
    const server = new AgentHookServer()
    const touch = vi.fn()
    providerOnly(server, '/sessions/first.jsonl')
    const uninstall = installHookStatusSessionTabsRepublish(server, () => ({
      getTerminalWorktreeIdForHandle: () => null,
      getTerminalWorktreeIdForPaneKey: () => null,
      scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree: vi.fn(),
      touchMobileSessionTabsForWorktree: touch
    }))
    try {
      server.transferPaneAuthority(PANE, 'tab-new:22222222-2222-4222-8222-222222222222')
      expect(touch).toHaveBeenCalledTimes(1)
      expect(touch).toHaveBeenCalledWith('repo::/worktree')
    } finally {
      uninstall()
    }
  })

  it('renews mobile freshness across its lease through a bounded heartbeat cadence', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const server = new AgentHookServer()
    const publications: number[] = []
    const rowMutations = vi.fn()
    const enrichedStatuses = vi.fn()
    const semanticStatuses = vi.fn()
    let heartbeat: ReturnType<typeof createMobileSessionTabsAgentStatusHeartbeat>
    const runtime = {
      getTerminalWorktreeIdForHandle: () => null,
      getTerminalWorktreeIdForPaneKey: () => null,
      scheduleMobileSessionTabsAgentStatusHeartbeatForWorktree: (worktreeId: string) =>
        heartbeat.scheduleWorktreeHeartbeat(worktreeId),
      touchMobileSessionTabsForWorktree: (worktreeId: string) => {
        heartbeat.observeWorktreeRefresh(worktreeId)
        publications.push(Date.now())
      }
    }
    heartbeat = createMobileSessionTabsAgentStatusHeartbeat(
      () => [],
      (worktreeId) => runtime.touchMobileSessionTabsForWorktree(worktreeId)
    )
    const uninstall = installHookStatusSessionTabsRepublish(server, () => runtime)
    server.subscribeStatusRowMutations(rowMutations)
    server.subscribeEnrichedStatus(enrichedStatuses)
    server.subscribeStatusChanges(semanticStatuses)
    const observation = {
      paneKey: PANE,
      tabId: 'tab-provider',
      worktreeId: 'repo::/worktree',
      payload: { state: 'working' as const, prompt: 'active', agentType: 'codex' as const }
    }

    try {
      server.ingestTerminalStatus(observation)
      for (let minute = 1; minute <= 31; minute += 1) {
        vi.advanceTimersByTime(60_000)
        server.ingestTerminalStatus(observation)
        vi.runOnlyPendingTimers()
      }

      expect(Date.now()).toBeGreaterThan(1_000 + AGENT_STATUS_STALE_AFTER_MS)
      const renewed = server.getStatusSnapshot()[0]
      expect(renewed?.state).toBe('working')
      expect(Date.now() - renewed!.receivedAt).toBeLessThan(AGENT_STATUS_STALE_AFTER_MS)
      expect(publications).toEqual([
        1_000,
        1_000 + SESSION_TABS_AGENT_STATUS_HEARTBEAT_INTERVAL_MS,
        1_000 + SESSION_TABS_AGENT_STATUS_HEARTBEAT_INTERVAL_MS * 2
      ])
      expect(rowMutations).toHaveBeenCalledTimes(1)
      expect(enrichedStatuses).toHaveBeenCalledTimes(1)
      expect(semanticStatuses).toHaveBeenCalledTimes(1)
    } finally {
      uninstall()
      heartbeat.dispose()
      server.stop()
    }
  })
})
