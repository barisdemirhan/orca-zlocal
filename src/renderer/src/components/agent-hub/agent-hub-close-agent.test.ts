import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeAgentHubAgent } from './agent-hub-close-agent'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'

const mocks = vi.hoisted(() => {
  const layouts: Record<string, unknown> = {}
  return {
    layouts,
    settings: { skipCloseTerminalWithRunningProcessConfirm: false },
    closeTerminalTab: vi.fn(),
    closeLeaf: vi.fn(),
    requestConfirm: vi.fn(),
    requestPane: vi.fn(),
    closeRemote: vi.fn(),
    ptyKill: vi.fn(),
    probe: vi.fn()
  }
})

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ terminalLayoutsByTabId: mocks.layouts, settings: mocks.settings })
  }
}))
vi.mock('@/store/slices/tabs/closing/running-terminal-close-confirm', () => ({
  useRunningTerminalCloseConfirmStore: {
    getState: () => ({ requestRunningTerminalCloseConfirm: mocks.requestConfirm })
  }
}))
vi.mock('../terminal-pane/layout/close/request-active-terminal-pane-close', () => ({
  requestActiveTerminalPaneClose: mocks.requestPane
}))
vi.mock('@/runtime/hosted-terminals/actions/web-runtime-terminal-close', () => ({
  closeWebRuntimeTerminal: mocks.closeRemote
}))
vi.mock('../terminal/terminal-tab-actions', () => ({ closeTerminalTab: mocks.closeTerminalTab }))
vi.mock('../terminal/pty-running-work-probe', () => ({ probePtyRunningWork: mocks.probe }))
vi.mock('../terminal-pane/layout/close/closed-terminal-leaf-notice', () => ({
  applyClosedTerminalLeafNotice: mocks.closeLeaf
}))

const LEAF_A = '11111111-1111-4111-8111-111111111111'
const LEAF_B = '22222222-2222-4222-8222-222222222222'

function target(leaf: string | null): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: makeRepo(),
    tab: makeTabWithIds('tab-1', worktree.id),
    paneKey: leaf ? `tab-1:${leaf}` : null,
    title: 'Fix bug',
    agentType: null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requestPane.mockReturnValue(true)
  mocks.closeRemote.mockReturnValue(false)
  mocks.ptyKill.mockResolvedValue(undefined)
  mocks.probe.mockResolvedValue([])
  vi.stubGlobal('window', { api: { pty: { kill: mocks.ptyKill } } })
  mocks.layouts['tab-1'] = { root: { type: 'leaf', leafId: LEAF_A } }
  mocks.settings.skipCloseTerminalWithRunningProcessConfirm = false
})

describe('closeAgentHubAgent', () => {
  it.each([
    ['idle', false],
    ['done', false],
    ['idle', true],
    ['done', true]
  ] as const)('confirms an explicit %s agent close even with terminal opt-out %s', (kind, skip) => {
    mocks.settings.skipCloseTerminalWithRunningProcessConfirm = skip
    closeAgentHubAgent({ ...target(LEAF_A), agentType: 'codex' }, kind)
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
    expect(mocks.ptyKill).not.toHaveBeenCalled()
    const [request] = mocks.requestConfirm.mock.calls[0] ?? []
    expect(request).toMatchObject({
      terminalTabId: 'tab-1',
      copyKind: 'agent',
      allowSkipConfirm: false
    })
    request.onConfirm()
    expect(mocks.closeTerminalTab).toHaveBeenCalledExactlyOnceWith('tab-1', {
      reason: 'user',
      skipRunningProcessConfirm: true
    })
  })

  it.each(['idle', 'done', null] as const)(
    'keeps the normal process guard for a %s tab',
    (kind) => {
      closeAgentHubAgent(target(LEAF_A), kind)
      expect(mocks.requestConfirm).not.toHaveBeenCalled()
      expect(mocks.closeTerminalTab).toHaveBeenCalledWith('tab-1', {
        reason: 'user',
        skipRunningProcessConfirm: false
      })
    }
  )

  it('asks for a working agent and closes only after confirm', () => {
    closeAgentHubAgent(target(LEAF_A), 'work')
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
    const [request] = mocks.requestConfirm.mock.calls[0] ?? []
    expect(request).toMatchObject({ terminalTabId: 'tab-1', copyKind: 'agent' })
    request.onConfirm()
    expect(mocks.closeTerminalTab).toHaveBeenCalledExactlyOnceWith('tab-1', {
      reason: 'user',
      skipRunningProcessConfirm: true
    })
  })

  it('honours the setting that turned off running-terminal close prompts', () => {
    mocks.settings.skipCloseTerminalWithRunningProcessConfirm = true
    closeAgentHubAgent(target(LEAF_A), 'work')
    expect(mocks.requestConfirm).not.toHaveBeenCalled()
    expect(mocks.closeTerminalTab).toHaveBeenCalledTimes(1)
  })

  const splitLayout = {
    root: {
      type: 'split',
      direction: 'vertical',
      first: { type: 'leaf', leafId: LEAF_A },
      second: { type: 'leaf', leafId: LEAF_B }
    },
    ptyIdsByLeafId: { [LEAF_B]: 'pty-b' }
  }

  it('closes only the mounted pane of a split tab through its own close path', () => {
    mocks.layouts['tab-1'] = splitLayout
    closeAgentHubAgent(target(LEAF_B), 'done')
    expect(mocks.requestPane).toHaveBeenCalledWith('tab-1', { leafId: LEAF_B, confirm: true })
    expect(mocks.ptyKill).not.toHaveBeenCalled()
    expect(mocks.closeLeaf).not.toHaveBeenCalled()
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
  })

  it('stops only that pane PTY when no mounted pane handles the close', async () => {
    mocks.layouts['tab-1'] = splitLayout
    mocks.requestPane.mockReturnValue(false)
    closeAgentHubAgent(target(LEAF_B), 'idle')
    await vi.waitFor(() => expect(mocks.ptyKill).toHaveBeenCalledExactlyOnceWith('pty-b'))
    expect(mocks.closeLeaf).toHaveBeenCalledWith('tab-1', LEAF_B, 'user')
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
  })

  it('leaves the kill to the runtime when it owns a remote PTY', async () => {
    mocks.layouts['tab-1'] = splitLayout
    mocks.requestPane.mockReturnValue(false)
    mocks.closeRemote.mockReturnValue(true)
    closeAgentHubAgent(target(LEAF_B), 'idle')
    await vi.waitFor(() => expect(mocks.closeLeaf).toHaveBeenCalledWith('tab-1', LEAF_B, 'user'))
    expect(mocks.ptyKill).not.toHaveBeenCalled()
    expect(mocks.closeLeaf).toHaveBeenCalledWith('tab-1', LEAF_B, 'user')
  })

  it('waits for confirmation before stopping an unmounted shell with a live command', async () => {
    mocks.layouts['tab-1'] = splitLayout
    mocks.requestPane.mockReturnValue(false)
    mocks.probe.mockResolvedValue([{ ptyId: 'pty-b', verdict: 'live' }])
    closeAgentHubAgent(target(LEAF_B), 'idle')
    await vi.waitFor(() => expect(mocks.requestConfirm).toHaveBeenCalledOnce())
    expect(mocks.ptyKill).not.toHaveBeenCalled()
    expect(mocks.closeLeaf).not.toHaveBeenCalled()
    const [request] = mocks.requestConfirm.mock.calls[0] ?? []
    request.onConfirm()
    expect(mocks.ptyKill).toHaveBeenCalledExactlyOnceWith('pty-b')
    expect(mocks.closeLeaf).toHaveBeenCalledWith('tab-1', LEAF_B, 'user')
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
  })
})
