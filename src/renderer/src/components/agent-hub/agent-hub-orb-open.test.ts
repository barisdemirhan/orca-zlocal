// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAgentHubOrbPanel,
  closeAgentHubOrbPanel,
  showAgentHubOrbPanel
} from './agent-hub-orb-panel-store'
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
vi.mock('@/lib/agent-session/structured-agent-session-tab-activation', () => ({
  findStructuredAgentSessionTab: mocks.find,
  activateStructuredAgentSessionTab: mocks.activate
}))
vi.mock('@/runtime/local-structured-session-tabs-sync/inventory-refresh', () => ({
  refreshLocalStructuredSessionTabs: mocks.refresh
}))
vi.mock('@/components/floating-terminal/workspace/floating-workspace-panel-reveal', () => ({
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
  it('reports disabled and other failures without changing the workspace', async () => {
    mocks.open.mockRejectedValueOnce({ code: 'disabled' })
    await openAgentHubOrb()
    expect(mocks.toast.error).toHaveBeenLastCalledWith('Enable Agent control to talk to Orb')
    mocks.open.mockRejectedValueOnce({ code: 'invalid_argument', message: 'Bad model' })
    await openAgentHubOrb()
    expect(mocks.toast.error).toHaveBeenLastCalledWith('Bad model')
    expect(mocks.settings).not.toHaveBeenCalled()
    expect(mocks.reveal).not.toHaveBeenCalled()
  })
  it('leaves open-panel failures inline and toasts only after the panel closes', async () => {
    showAgentHubOrbPanel({ sessionId: 'current-session', tabId: 'current-tab', resumed: false })
    mocks.open.mockRejectedValue({ code: 'invalid_argument', message: 'Bad model' })
    expect(await openAgentHubOrb({ resume: { sessionId: 'past-session' } })).toBe(false)
    expect(mocks.toast.error).not.toHaveBeenCalled()
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('current-session')
    closeAgentHubOrbPanel()
    expect(await openAgentHubOrb()).toBe(false)
    expect(mocks.toast.error).toHaveBeenCalledExactlyOnceWith('Bad model')
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
  it('keeps the secondary panel view while applying saved settings', async () => {
    await openAgentHubOrb()
    useAgentHubOrbPanel.setState({ chatVisible: false })
    mocks.open.mockResolvedValueOnce({ sessionId: 'updated-session', resumed: false })
    await openAgentHubOrb(undefined, true)
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('updated-session')
    expect(useAgentHubOrbPanel.getState().chatVisible).toBe(false)
  })
  it('joins concurrent presses and reports a missing published tab', async () => {
    mocks.find.mockReturnValue(null)
    await Promise.all([openAgentHubOrb(), openAgentHubOrb()])
    expect(mocks.open).toHaveBeenCalledOnce()
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.toast.error).toHaveBeenCalledWith('Could not open Orb. Try again.')
  })
  it('queues a history resume after an in-flight open instead of showing its conversation', async () => {
    let finish: ((session: { sessionId: string; resumed: boolean }) => void) | undefined
    mocks.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    mocks.open.mockResolvedValueOnce({ sessionId: 'past-session', resumed: true })
    const first = openAgentHubOrb()
    const resume = openAgentHubOrb({ resume: { sessionId: 'past-session' } })
    await Promise.resolve()
    finish?.({ sessionId: 'first-session', resumed: false })
    await Promise.all([first, resume])
    expect(mocks.open).toHaveBeenCalledTimes(2)
    expect(mocks.open).toHaveBeenLastCalledWith({ resume: { sessionId: 'past-session' } })
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('past-session')
  })
  it('performs a settings reopen after an in-flight open with the same empty params', async () => {
    let finish: ((session: { sessionId: string; resumed: boolean }) => void) | undefined
    mocks.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    mocks.open.mockResolvedValueOnce({ sessionId: 'settings-session', resumed: false })
    const first = openAgentHubOrb()
    const updated = openAgentHubOrb(undefined, true)
    await Promise.resolve()
    finish?.({ sessionId: 'first-session', resumed: false })
    await Promise.all([first, updated])
    expect(mocks.open).toHaveBeenCalledTimes(2)
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('settings-session')
  })
  it('opens a fresh conversation after New closes the panel during an in-flight open', async () => {
    let finish: ((session: { sessionId: string; resumed: boolean }) => void) | undefined
    mocks.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    mocks.open.mockResolvedValueOnce({ sessionId: 'new-session', resumed: false })
    const first = openAgentHubOrb()
    closeAgentHubOrbPanel()
    const fresh = openAgentHubOrb()
    await Promise.resolve()
    finish?.({ sessionId: 'closed-session', resumed: false })
    await Promise.all([first, fresh])
    expect(mocks.open).toHaveBeenCalledTimes(2)
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('new-session')
  })
  it('opens again after the host finished its first call but its tab repair is still pending', async () => {
    let finishRepair: (() => void) | undefined
    mocks.find.mockReturnValueOnce(null)
    mocks.refresh.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRepair = resolve
        })
    )
    const first = openAgentHubOrb()
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    mocks.open.mockResolvedValueOnce({ sessionId: 'new-session', resumed: false })
    const fresh = openAgentHubOrb()
    finishRepair?.()
    await Promise.all([first, fresh])
    expect(mocks.open).toHaveBeenCalledTimes(2)
    expect(useAgentHubOrbPanel.getState().session?.sessionId).toBe('new-session')
  })
})
