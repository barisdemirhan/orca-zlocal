import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type * as Rpc from '@/runtime/runtime-rpc-client'
import type * as Owner from '@/lib/worktree-runtime-owner'
import { makeTab, makeWorktree } from '@/store/slices/store-test-helpers'
import { changeAgentHubTerminalSuspension } from './agent-hub-terminal-suspension'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

const call = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-rpc-client', async (original) => ({
  ...(await original<typeof Rpc>()),
  callRuntimeRpc: call
}))
vi.mock('@/lib/worktree-runtime-owner', async (original) => ({
  ...(await original<typeof Owner>()),
  resolveRuntimeOwnerForWorktree: () => ({ kind: 'non-runtime' })
}))
const initial = useAppStore.getState()
const leaf = '11111111-1111-4111-8111-111111111111'
const target: AgentHubPaneTarget = {
  worktree: makeWorktree({ id: 'wt', repoId: 'repo' }),
  tab: makeTab({ id: 'tab', worktreeId: 'wt' }),
  repo: null,
  paneKey: `tab:${leaf}`,
  agentType: null,
  title: 'Shell'
}
function seed() {
  useAppStore.setState({
    ptyIdsByTabId: { tab: ['raw-pty'] },
    terminalLayoutsByTabId: {
      tab: {
        root: { type: 'leaf', leafId: leaf },
        activeLeafId: leaf,
        expandedLeafId: null,
        ptyIdsByLeafId: { [leaf]: 'raw-pty' }
      }
    }
  })
}
afterEach(() => {
  call.mockReset()
  useAppStore.setState(initial, true)
})

it('uses the host-resolved terminal handle and the observed process incarnation to pause', async () => {
  seed()
  call.mockResolvedValueOnce({ terminal: { handle: 'host-handle', ptyId: 'raw-pty' } })
  call.mockResolvedValueOnce({ state: 'awake', incarnationId: 'incarnation' })
  await expect(changeAgentHubTerminalSuspension(target)).resolves.toEqual({
    state: 'awake',
    incarnationId: 'incarnation'
  })
  call.mockResolvedValueOnce({ terminal: { handle: 'host-handle', ptyId: 'raw-pty' } })
  call.mockResolvedValueOnce({ state: 'suspended', incarnationId: 'incarnation' })
  await expect(changeAgentHubTerminalSuspension(target, true)).resolves.toMatchObject({
    state: 'suspended'
  })
  expect(call).toHaveBeenLastCalledWith(
    { kind: 'local' },
    'terminal.suspension',
    { terminal: 'host-handle', suspended: true, expectedIncarnationId: 'incarnation' },
    { timeoutMs: 7_000 }
  )
})

it('does not pause a different process returned for the same pane', async () => {
  seed()
  call.mockResolvedValueOnce({ terminal: { handle: 'new-handle', ptyId: 'replacement' } })
  await expect(changeAgentHubTerminalSuspension(target, true)).resolves.toEqual({
    state: 'unverifiable'
  })
  expect(call).toHaveBeenCalledOnce()
})

it('does not pause after the renderer binding changes during handle resolution', async () => {
  seed()
  call.mockImplementationOnce(async () => {
    useAppStore.setState({ ptyIdsByTabId: { tab: ['replacement'] } })
    return { terminal: { handle: 'old-handle', ptyId: 'raw-pty' } }
  })
  await expect(changeAgentHubTerminalSuspension(target, true)).resolves.toEqual({
    state: 'unverifiable'
  })
  expect(call).toHaveBeenCalledOnce()
})

it('reports loss of contact as unverifiable without attempting a signal', async () => {
  seed()
  call.mockRejectedValueOnce(new Error('disconnected'))
  await expect(changeAgentHubTerminalSuspension(target, false)).resolves.toEqual({
    state: 'unverifiable'
  })
  expect(call).toHaveBeenCalledOnce()
})
