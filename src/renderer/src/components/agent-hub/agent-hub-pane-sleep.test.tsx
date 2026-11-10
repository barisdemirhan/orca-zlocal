// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTab } from '@/store/terminals/terminal-tab.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { useAgentHubPaneSleep } from './agent-hub-pane-sleep'
import type * as SleepOperations from './agent-hub-pane-sleep-operations'

const sleep = vi.hoisted(() => vi.fn())
vi.mock('./agent-hub-pane-sleep-operations', async (original) => ({
  ...(await original<typeof SleepOperations>()),
  sleepAgentHubPane: sleep
}))
vi.mock('./agent-hub-terminal-suspension', () => ({
  readAgentHubTerminalSuspension: () => undefined,
  changeAgentHubTerminalSuspension: vi.fn(),
  useAgentHubTerminalSuspension: () => undefined,
  useAgentHubTerminalSuspensionTest: () => () => false
}))
afterEach(() => {
  cleanup()
  sleep.mockReset()
})

const target = {
  worktree: makeWorktree({ id: 'wt', repoId: 'repo' }),
  tab: makeTab({ id: 'tab', worktreeId: 'wt' }),
  repo: null,
  paneKey: 'tab:leaf',
  agentType: 'codex' as const,
  title: 'A'
}

it('keeps a precondition error out of the phase so the pane stays awake', async () => {
  sleep.mockRejectedValueOnce(new Error('The selected pane changed. Try again.'))
  const { result } = renderHook(() => useAgentHubPaneSleep(target))
  await act(async () => {
    await result.current.sleep().catch(() => undefined)
  })
  expect(result.current.phase).toBe('awake')
  expect(result.current.error).toBe('The selected pane changed. Try again.')
})

it('reports unverifiable only when the host could not confirm the result', async () => {
  const unconfirmed = { ...target, paneKey: 'tab:other' }
  sleep.mockRejectedValueOnce(new Error('Terminal wake could not be verified on the host.'))
  const { result } = renderHook(() => useAgentHubPaneSleep(unconfirmed))
  await act(async () => {
    await result.current.sleep().catch(() => undefined)
  })
  expect(result.current.phase).toBe('unverifiable')
})
