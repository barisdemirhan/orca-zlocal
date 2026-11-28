import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type * as Rpc from '@/runtime/rpc/calls/runtime-rpc-call'
import type * as Route from '@/lib/workspace/ownership/terminal-worktree-route'
import { makeTab } from '@/store/terminals/testing/terminal-tab.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { changeAgentHubTerminalSuspension } from './agent-hub-terminal-suspension'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

const call = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/rpc/calls/runtime-rpc-call', async (original) => ({
  ...(await original<typeof Rpc>()),
  callRuntimeRpc: call
}))
vi.mock('@/lib/workspace/ownership/terminal-worktree-route', async (original) => ({
  ...(await original<typeof Route>()),
  resolveTerminalPtyOwner: () => ({ kind: 'non-runtime' })
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

it('reports an old host without terminal.suspension as unsupported, not unverifiable', async () => {
  seed()
  call.mockResolvedValueOnce({ terminal: { handle: 'host-handle', ptyId: 'raw-pty' } })
  call.mockRejectedValueOnce(
    Object.assign(new Error('Unknown method'), { code: 'method_not_found' })
  )
  await expect(changeAgentHubTerminalSuspension(target, true)).resolves.toEqual({
    state: 'unsupported'
  })
})
