// @vitest-environment happy-dom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type * as Rpc from '@/runtime/runtime-rpc-client'
import type * as Owner from '@/lib/workspace/ownership/worktree-runtime-owner'
import type * as Route from '@/lib/terminal-worktree-route'
import { makeTab, makeWorktree } from '@/store/slices/store-test-helpers'
import { useAgentHubManualSleepHostReason } from './agent-hub-pane-sleep-operations'

const capability = vi.hoisted(() => vi.fn(async () => false))
vi.mock('@/runtime/runtime-rpc-client', async (original) => ({
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
afterEach(() => {
  cleanup()
  capability.mockReset().mockResolvedValue(false)
})

const tab = makeTab({ id: 'tab', worktreeId: 'wt' })
const worktree = makeWorktree({ id: 'wt', repoId: 'repo' })
const agent = {
  worktree,
  tab,
  repo: null,
  paneKey: 'tab:leaf',
  agentType: 'codex' as const,
  title: 'A'
}

it('explains an old remote host before the checkpoint reason, for agents only', async () => {
  const { result } = renderHook(() => useAgentHubManualSleepHostReason(agent))
  await waitFor(() =>
    expect(result.current).toBe('Update Orca on the execution host before using manual pane sleep.')
  )
  const terminal = renderHook(() => useAgentHubManualSleepHostReason({ ...agent, agentType: null }))
  expect(terminal.result.current).toBeUndefined()
})

it('stays silent when the remote host supports manual sleep', async () => {
  capability.mockResolvedValue(true)
  const { result } = renderHook(() => useAgentHubManualSleepHostReason(agent))
  await waitFor(() => expect(capability).toHaveBeenCalled())
  expect(result.current).toBeUndefined()
})
