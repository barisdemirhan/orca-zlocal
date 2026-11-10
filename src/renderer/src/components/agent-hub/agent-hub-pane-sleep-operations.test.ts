import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type * as Rpc from '@/runtime/rpc/compatibility/runtime-capability-proof'
import type * as Owner from '@/lib/workspace/ownership/worktree-runtime-owner'
import type * as Route from '@/lib/terminal-worktree-route'
import type * as Authority from '@/lib/workspace/ownership/workspace-terminal-host-authority'
import { makeTab } from '@/store/terminals/terminal-tab.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { makeWorkingEntryWithoutHistory } from '../activity/ActivityPrototypePage-test-fixtures'
import { sleepAgentHubPane } from './agent-hub-pane-sleep-operations'
import { AGENT_HUB_MANUAL_PANE_SLEEP_CAPABILITY } from '../../../../shared/agent-hub-capabilities'

const capability = vi.hoisted(() => vi.fn(async () => false))
vi.mock('@/runtime/rpc/compatibility/runtime-capability-proof', async (original) => ({
  ...(await original<typeof Rpc>()),
  runtimeEnvironmentSupportsCapability: capability
}))
vi.mock('@/lib/workspace/ownership/worktree-runtime-owner', async (original) => ({
  ...(await original<typeof Owner>()),
  runtimeEnvironmentIdOrLocalUnlessTwin: () => 'old-host'
}))
vi.mock('@/lib/terminal-worktree-route', async (original) => ({
  ...(await original<typeof Route>()),
  resolveTerminalPtyOwner: () => ({ kind: 'runtime', environmentId: 'old-host' })
}))
vi.mock('@/lib/workspace/ownership/workspace-terminal-host-authority', async (original) => ({
  ...(await original<typeof Authority>()),
  resolveWorkspaceTerminalHostAuthority: () => 'live'
}))
const initial = useAppStore.getState()
afterEach(() => {
  useAppStore.setState(initial, true)
  capability.mockReset().mockResolvedValue(false)
})

it('never stops an older remote host that may discard the explicit-wake checkpoint field', async () => {
  const leafId = '11111111-1111-4111-8111-111111111111'
  const paneKey = `tab:${leafId}`
  const tab = makeTab({ id: 'tab', worktreeId: 'wt' })
  const worktree = makeWorktree({ id: 'wt', repoId: 'repo' })
  const shutdown = vi.fn(async () => {})
  useAppStore.setState({
    tabsByWorktree: { wt: [tab] },
    worktreesByRepo: { repo: [worktree] },
    ptyIdsByTabId: { tab: ['pty'] },
    terminalLayoutsByTabId: {
      tab: {
        root: { type: 'leaf', leafId },
        activeLeafId: leafId,
        expandedLeafId: null,
        ptyIdsByLeafId: { [leafId]: 'pty' }
      }
    },
    agentStatusByPaneKey: {
      [paneKey]: {
        ...makeWorkingEntryWithoutHistory(),
        paneKey,
        tabId: 'tab',
        worktreeId: 'wt',
        agentType: 'codex',
        providerSession: { key: 'session_id', id: 'saved-session' }
      }
    },
    shutdownCompletedAgentPaneForHibernation: shutdown
  })
  const target = { worktree, tab, repo: null, paneKey, agentType: 'codex' as const, title: 'Agent' }
  await expect(sleepAgentHubPane(target)).rejects.toThrow('Update Orca on the execution host')
  expect(capability).toHaveBeenCalledWith('old-host', AGENT_HUB_MANUAL_PANE_SLEEP_CAPABILITY)
  expect(shutdown).not.toHaveBeenCalled()
  capability.mockResolvedValue(true)
  await sleepAgentHubPane(target)
  expect(shutdown).toHaveBeenCalledExactlyOnceWith(
    'wt',
    expect.objectContaining({ paneKey, manual: true, expectedRuntimePtyId: 'pty' })
  )
})
