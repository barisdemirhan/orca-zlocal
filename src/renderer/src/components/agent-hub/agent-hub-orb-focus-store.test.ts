import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { makeTab, makeWorktree } from '@/store/slices/store-test-helpers'
import {
  agentHubOrbTargetKey,
  toggleAgentHubOrbPin,
  toggleAgentHubOrbWatch,
  pruneAgentHubOrbFocus,
  useAgentHubOrbFocusStore
} from './agent-hub-orb-focus-store'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

const resolveTerminal = vi.hoisted(() => vi.fn())
vi.mock('./agent-hub-target-terminal', () => ({
  resolveAgentHubTargetTerminal: resolveTerminal
}))

const initial = useAppStore.getState()
const leaf = '11111111-1111-4111-8111-111111111111'
const target: AgentHubPaneTarget = {
  worktree: makeWorktree({ id: 'wt', repoId: 'repo', hostId: 'local' }),
  tab: makeTab({ id: 'tab', worktreeId: 'wt' }),
  repo: null,
  paneKey: `tab:${leaf}`,
  agentType: 'codex',
  title: 'Target'
}
function seed() {
  resolveTerminal.mockResolvedValue({ transport: { kind: 'local' }, terminal: 'host-handle' })
  useAppStore.setState({
    tabsByWorktree: { wt: [target.tab] },
    ptyIdsByTabId: { tab: ['pty'] },
    terminalLayoutsByTabId: {
      tab: {
        root: { type: 'leaf', leafId: leaf },
        activeLeafId: leaf,
        expandedLeafId: null,
        ptyIdsByLeafId: { [leaf]: 'pty' }
      }
    }
  })
}
afterEach(() => {
  useAppStore.setState(initial, true)
  useAgentHubOrbFocusStore.setState({ watches: new Map(), pinned: null })
  resolveTerminal.mockReset()
})
describe('explicit Orb scope', () => {
  it('starts empty, normalizes a tab to its current pane and stops on explicit toggle', () => {
    seed()
    expect(useAgentHubOrbFocusStore.getState().watches.size).toBe(0)
    toggleAgentHubOrbWatch({ ...target, paneKey: null })
    expect(useAgentHubOrbFocusStore.getState().watches.has(agentHubOrbTargetKey(target))).toBe(true)
    toggleAgentHubOrbWatch(target)
    expect(useAgentHubOrbFocusStore.getState().watches.size).toBe(0)
  })
  it('retires watch and pin when the exact PTY changes or the selected time expires', () => {
    seed()
    toggleAgentHubOrbWatch(target)
    toggleAgentHubOrbPin(target)
    useAppStore.setState({ ptyIdsByTabId: { tab: ['replacement'] } })
    pruneAgentHubOrbFocus()
    expect(useAgentHubOrbFocusStore.getState().watches.size).toBe(0)
    expect(useAgentHubOrbFocusStore.getState().pinned).toBeNull()
    seed()
    toggleAgentHubOrbWatch(target)
    toggleAgentHubOrbPin(target)
    pruneAgentHubOrbFocus(Date.now() + 61 * 60_000)
    expect(useAgentHubOrbFocusStore.getState().watches.size).toBe(0)
    expect(useAgentHubOrbFocusStore.getState().pinned).toBeNull()
  })
  it('keeps equal pane IDs on different execution hosts separate', () => {
    seed()
    const remote = {
      ...target,
      worktree: { ...target.worktree, hostId: 'runtime:remote' as const }
    }
    expect(agentHubOrbTargetKey(remote)).not.toBe(agentHubOrbTargetKey(target))
  })
  it('resolves the host address and never restores a pin after the user released it', async () => {
    seed()
    toggleAgentHubOrbWatch(target)
    await vi.waitFor(() =>
      expect([...useAgentHubOrbFocusStore.getState().watches.values()][0]?.terminalHandle).toBe(
        'host-handle'
      )
    )
    const pending = Promise.withResolvers<{ terminal: string }>()
    resolveTerminal.mockReturnValueOnce(pending.promise)
    toggleAgentHubOrbPin(target)
    toggleAgentHubOrbPin(target)
    pending.resolve({ terminal: 'late-handle' })
    await pending.promise
    expect(useAgentHubOrbFocusStore.getState().pinned).toBeNull()
  })
})
