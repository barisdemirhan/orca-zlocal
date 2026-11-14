/** @vitest-environment happy-dom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { useAgentHubShortcutInitialization } from './use-agent-hub-shortcut-initialization'
import type { KeybindingOverrides, KeybindingFileSnapshot } from '../../../../shared/keybindings'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const keybindings: KeybindingOverrides = {}
  const useAppStore = create(() => ({
    settings: { experimentalAgentHub: false, agentHubShortcutsInitialized: false },
    keybindingSnapshot: null,
    keybindings,
    updateSettingsOrThrow: vi.fn(async (updates: { agentHubShortcutsInitialized: boolean }) => {
      useAppStore.setState((s) => ({ settings: { ...s.settings, ...updates } }))
    }),
    setKeybindingOverride: vi.fn(async (id: string, bindings: string[]) => {
      useAppStore.setState((s) => ({ keybindings: { ...s.keybindings, [id]: bindings } }))
    })
  }))
  return { useAppStore }
})
vi.mock('@/lib/keyboard/shortcut-platform', () => ({ getShortcutPlatform: () => 'darwin' }))
vi.mock('@/store/plugins/catalog/plugin-contribution-catalog', () => ({
  useEditablePluginCommands: () => []
}))

beforeEach(() => {
  useAppStore.setState((s) => ({
    settings: s.settings
      ? { ...s.settings, experimentalAgentHub: false, agentHubShortcutsInitialized: false }
      : null,
    keybindings: {},
    keybindingSnapshot: null
  }))
  vi.clearAllMocks()
})
afterEach(cleanup)

it('waits for keybindings hydration before filling actions at an enabled launch', async () => {
  useAppStore.setState((s) => ({
    settings: s.settings ? { ...s.settings, experimentalAgentHub: true } : null
  }))
  renderHook(useAgentHubShortcutInitialization)
  expect(useAppStore.getState().setKeybindingOverride).not.toHaveBeenCalled()
  const snapshot: KeybindingFileSnapshot = {
    path: '',
    platform: 'darwin',
    exists: true,
    overrides: {},
    commonOverrides: {},
    platformOverrides: {},
    diagnostics: []
  }
  act(() => useAppStore.setState({ keybindingSnapshot: snapshot }))
  await waitFor(() =>
    expect(useAppStore.getState().keybindings['agentHub.previousMirrorTab']).toEqual([
      'Mod+Alt+Shift+BracketLeft'
    ])
  )
  expect(useAppStore.getState().keybindings['agentHub.toggleOrb']).toBeUndefined()
  expect(useAppStore.getState().settings?.agentHubShortcutsInitialized).toBe(true)
})

it('initializes after enabling and preserves a removal across a remount', async () => {
  const snapshot: KeybindingFileSnapshot = {
    path: '',
    platform: 'darwin',
    exists: true,
    overrides: {},
    commonOverrides: {},
    platformOverrides: {},
    diagnostics: []
  }
  useAppStore.setState({ keybindingSnapshot: snapshot })
  const view = renderHook(useAgentHubShortcutInitialization)
  expect(useAppStore.getState().setKeybindingOverride).not.toHaveBeenCalled()
  act(() =>
    useAppStore.setState((s) => ({
      settings: s.settings ? { ...s.settings, experimentalAgentHub: true } : null
    }))
  )
  await waitFor(() =>
    expect(useAppStore.getState().keybindings['agentHub.previousMirrorTab']).toEqual([
      'Mod+Alt+Shift+BracketLeft'
    ])
  )
  expect(useAppStore.getState().keybindings['agentHub.toggleOrb']).toBeUndefined()
  vi.mocked(useAppStore.getState().setKeybindingOverride).mockClear()
  act(() =>
    useAppStore.setState((s) => ({ keybindings: { ...s.keybindings, 'agentHub.popOut': [] } }))
  )
  view.unmount()
  renderHook(useAgentHubShortcutInitialization)
  expect(useAppStore.getState().keybindings['agentHub.popOut']).toEqual([])
  expect(useAppStore.getState().setKeybindingOverride).not.toHaveBeenCalled()
})
