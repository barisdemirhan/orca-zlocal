// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAgentHubOrbPanel, closeAgentHubOrbPanel } from './agent-hub-orb-panel-store'
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
  closeAgentHubOrbPanel()
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
  it('opens its attached panel, repairing a publication race without navigating the floating workspace', async () => {
    mocks.find.mockReturnValueOnce(null)
    await openAgentHubOrb()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(useAgentHubOrbPanel.getState().session).toEqual({
      sessionId: 'orb-session',
      tabId: 'orb-tab',
      resumed: false
    })
    expect(mocks.reveal).not.toHaveBeenCalled()
    expect(mocks.activate).not.toHaveBeenCalled()
  })
  it('routes history resumes through the same panel entry point', async () => {
    await openAgentHubOrb({ resume: { sessionId: 'orb-session' } })
    expect(mocks.open).toHaveBeenCalledWith({ resume: { sessionId: 'orb-session' } })
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('orb-session')
  })
  it('joins concurrent presses and reports a missing published tab', async () => {
    mocks.find.mockReturnValue(null)
    await Promise.all([openAgentHubOrb(), openAgentHubOrb()])
    expect(mocks.open).toHaveBeenCalledOnce()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.toast.error).toHaveBeenCalledWith('Could not open Orb. Try again.')
  })
})
