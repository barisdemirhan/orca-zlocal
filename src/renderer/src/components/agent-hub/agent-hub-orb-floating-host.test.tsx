// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useFloatingWorkspacePanel } from '../floating-terminal/workspace/use-floating-workspace-panel'
import { closeAgentHubOrbPanel, showAgentHubOrbPanel } from './agent-hub-orb-panel-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      floatingWorkspacePanelOpen: false,
      settings: { floatingTerminalEnabled: false },
      statusBarVisible: true,
      setFloatingWorkspacePanelOpen: vi.fn()
    }))
  }
})
vi.mock('@/store/workspaces/floating/floating-workspace-panel-selector', () => ({
  selectFloatingVisibleTabCount: () => 1
}))
afterEach(() => {
  cleanup()
  closeAgentHubOrbPanel()
})

it('mounts the retained Orb chat host while keeping the disabled floating workspace closed', () => {
  closeAgentHubOrbPanel()
  const { result } = renderHook(() => useFloatingWorkspacePanel())
  expect(result.current.shouldMountPanel).toBe(false)
  act(() => showAgentHubOrbPanel({ sessionId: 'orb', tabId: 'orb-tab', resumed: false }))
  expect(result.current.shouldMountPanel).toBe(true)
  expect(result.current.open).toBe(false)
  expect(result.current.showToggleButton).toBe(false)
  act(() => closeAgentHubOrbPanel())
  expect(result.current.shouldMountPanel).toBe(false)
})
