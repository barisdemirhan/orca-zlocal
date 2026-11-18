// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/workspace/identity/floating-workspace-id'
import type { RuntimeMobileSessionTabsResult } from '../../../../shared/remote-runtime/session-graph/runtime-session-contracts'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { resetLocalStructuredSessionVersionForTests } from '@/runtime/local-structured-session-tabs-sync/inventory-generation-fence'
import { LOCAL_STRUCTURED_SESSION_OWNER } from '@/runtime/native-chat/local-sessions/local-structured-session-owner'
import { applyWebSessionTabsSnapshot } from '@/runtime/web-session-tabs-sync/snapshot-api'
import { resetWebSessionTabsSyncTestState } from '@/runtime/web-session-tabs-sync/testing/web-session-tabs-sync.test-fixture'
import { closeAgentHubOrbPanel, useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { openAgentHubOrb } from './agent-hub-orb-open'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const initialState = useAppStore.getInitialState()
const priorApi = window.api
const sessionId = 'orb-publication-session'
const snapshot: RuntimeMobileSessionTabsResult = {
  worktree: FLOATING_TERMINAL_WORKTREE_ID,
  publicationEpoch: 'orb-publication-epoch',
  snapshotVersion: 1,
  activeGroupId: 'host-orb-group',
  activeTabId: `agent-session:${sessionId}`,
  activeTabType: 'agent-session',
  tabs: [
    {
      type: 'agent-session',
      id: `agent-session:${sessionId}`,
      title: 'Orb',
      sessionId,
      agent: 'codex',
      isActive: true
    }
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  resetLocalStructuredSessionVersionForTests()
  resetWebSessionTabsSyncTestState()
  useAppStore.setState(
    {
      ...initialState,
      settings: { ...getDefaultSettings('/test-home'), floatingTerminalEnabled: false }
    },
    true
  )
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      agentHub: {
        orb: { open: vi.fn().mockResolvedValue({ sessionId, tabId: 'host-tab', resumed: false }) }
      },
      runtime: {
        call: vi.fn().mockResolvedValue({ ok: true, result: { snapshots: [snapshot] } })
      }
    }
  })
})

afterEach(() => {
  closeAgentHubOrbPanel()
  useAppStore.setState(initialState, true)
  Object.defineProperty(window, 'api', { configurable: true, value: priorApi })
})

describe('Orb publication into the floating workspace', () => {
  it.each([false, true])(
    'opens with an existing floating terminal: %s',
    async (existingTerminal) => {
      const terminal = existingTerminal
        ? useAppStore.getState().createTab(FLOATING_TERMINAL_WORKTREE_ID)
        : null
      const before = useAppStore.getState()
      await openAgentHubOrb()

      const state = useAppStore.getState()
      const tab = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, {
        workspaceId: FLOATING_TERMINAL_WORKTREE_ID,
        sessionId,
        target: { kind: 'local' }
      })
      expect(tab).toMatchObject({ entityId: sessionId, executionHostId: 'local' })
      expect(useAgentHubOrbPanel.getState().session).toEqual({
        sessionId,
        tabId: tab?.id,
        resumed: false
      })
      expect(toast.error).not.toHaveBeenCalled()
      expect(state.settings?.floatingTerminalEnabled).toBe(false)
      expect(state.activeWorktreeId).toBe(before.activeWorktreeId)
      expect(state.tabsByWorktree).toEqual(before.tabsByWorktree)
      if (terminal) {
        expect(state.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toContainEqual(
          before.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID][0]
        )
        const group = before.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID][0]
        expect(state.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toContainEqual(
          expect.objectContaining({ id: group.id, activeTabId: terminal.id })
        )
        expect(state.layoutByWorktree).toEqual(before.layoutByWorktree)
      }

      for (const [owner, options] of [
        ['remote-host', undefined],
        ['remote-host', { contentScope: 'agent-session' as const, preserveLocalLayout: true }],
        [LOCAL_STRUCTURED_SESSION_OWNER, undefined]
      ] as const) {
        const rejected = applyWebSessionTabsSnapshot(
          state,
          { ...snapshot, snapshotVersion: 2, tabs: [] },
          owner,
          Date.now(),
          options
        )
        expect(rejected).toBe(state)
      }
    }
  )
})
