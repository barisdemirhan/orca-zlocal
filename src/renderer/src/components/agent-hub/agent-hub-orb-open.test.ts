// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { useAppStore } from '@/store'
import { openAgentHubOrb } from './agent-hub-orb-open'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  find: vi.fn(),
  activate: vi.fn(),
  refresh: vi.fn(),
  reveal: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  settings: vi.fn(),
  page: vi.fn()
}))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      unifiedTabsByWorktree: {},
      activeTabId: null,
      groupsByWorktree: {},
      activeGroupIdByWorktree: {},
      floatingWorkspacePanelOpen: false,
      settings: { floatingTerminalEnabled: true },
      openSettingsTarget: mocks.settings,
      openSettingsPage: mocks.page
    }))
  }
})
vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  findStructuredAgentSessionTab: mocks.find,
  activateStructuredAgentSessionTab: mocks.activate
}))
vi.mock('@/runtime/local-structured-session-tabs-sync', () => ({
  refreshLocalStructuredSessionTabs: mocks.refresh
}))
vi.mock('@/lib/floating-workspace-panel-reveal', () => ({
  revealFloatingWorkspacePanel: mocks.reveal
}))
beforeEach(() => {
  vi.clearAllMocks()
  document.body.replaceChildren()
  useAppStore.setState({
    activeTabId: null,
    floatingWorkspacePanelOpen: false,
    groupsByWorktree: {},
    activeGroupIdByWorktree: {}
  })
  mocks.open.mockResolvedValue({ sessionId: 'orb-session', tabId: 'orb-tab', resumed: false })
  mocks.find.mockReturnValue({ id: 'orb-tab', groupId: 'orb-group' })
  mocks.activate.mockReturnValue(true)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { agentHub: { orb: { open: mocks.open } } }
  })
})
describe('open Orb', () => {
  it('opens Agent Hub settings and explains a missing folder', async () => {
    mocks.open.mockRejectedValue({ code: 'invalid_argument', message: 'Choose a working folder' })
    await openAgentHubOrb()
    expect(mocks.settings).toHaveBeenCalledWith({ pane: 'agentHub', repoId: null })
    expect(mocks.page).toHaveBeenCalledOnce()
    expect(mocks.toast).toHaveBeenCalledWith("Choose the Orb's working folder first")
    expect(mocks.reveal).not.toHaveBeenCalled()
  })
  it('reports disabled and other failures without changing the workspace', async () => {
    mocks.open.mockRejectedValueOnce({ code: 'disabled' })
    await openAgentHubOrb()
    expect(mocks.toast.error).toHaveBeenLastCalledWith('Enable Agent control to talk to Orb')
    mocks.open.mockRejectedValueOnce({ code: 'invalid_argument', message: 'Bad model' })
    await openAgentHubOrb()
    expect(mocks.toast.error).toHaveBeenLastCalledWith('Could not open Orb. Try again.')
    expect(mocks.settings).not.toHaveBeenCalled()
    expect(mocks.reveal).not.toHaveBeenCalled()
  })
  it('reveals and activates its existing local floating chat, repairing a publication race', async () => {
    mocks.find.mockReturnValueOnce(null)
    await openAgentHubOrb()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.reveal).toHaveBeenCalledOnce()
    expect(mocks.activate).toHaveBeenCalledWith({
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      tabId: 'orb-tab',
      target: { kind: 'local' }
    })
  })
  it('closes a visible focused Orb, but leaves it open when another field has focus', async () => {
    const toggle = vi.fn()
    window.addEventListener(TOGGLE_FLOATING_TERMINAL_EVENT, toggle)
    const panel = document.createElement('div')
    panel.dataset.floatingTerminalPanel = ''
    const field = document.createElement('textarea')
    panel.append(field)
    document.body.append(panel)
    useAppStore.setState({
      floatingWorkspacePanelOpen: true,
      activeTabId: 'main-tab',
      groupsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          {
            id: 'orb-group',
            worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
            tabOrder: ['orb-tab'],
            activeTabId: 'orb-tab'
          }
        ]
      },
      activeGroupIdByWorktree: { [FLOATING_TERMINAL_WORKTREE_ID]: 'orb-group' }
    })
    field.focus()
    await openAgentHubOrb()
    expect(toggle).toHaveBeenCalledOnce()
    expect(mocks.activate).not.toHaveBeenCalled()
    const outside = document.createElement('input')
    document.body.append(outside)
    outside.focus()
    await openAgentHubOrb()
    expect(toggle).toHaveBeenCalledOnce()
    expect(mocks.activate).toHaveBeenCalledOnce()
    window.removeEventListener(TOGGLE_FLOATING_TERMINAL_EVENT, toggle)
  })
  it('joins concurrent presses and reports a missing published tab', async () => {
    mocks.find.mockReturnValue(null)
    await Promise.all([openAgentHubOrb(), openAgentHubOrb()])
    expect(mocks.open).toHaveBeenCalledOnce()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.toast.error).toHaveBeenCalledWith('Could not open Orb. Try again.')
  })
})
