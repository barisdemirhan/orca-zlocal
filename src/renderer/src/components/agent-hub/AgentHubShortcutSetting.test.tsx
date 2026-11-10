/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeybindingOverrides } from '../../../../shared/keybindings'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubShortcutSetting } from './AgentHubShortcutSetting'
import { AGENT_HUB_SUGGESTED_BINDINGS } from './agent-hub-shortcut-suggestions'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const initialBindings: KeybindingOverrides = {}
  const useAppStore = create(() => ({
    keybindings: initialBindings,
    keybindingSnapshot: null,
    settings: {},
    setKeybindingOverride: vi.fn(async (id: string, bindings: string[]) => {
      useAppStore.setState((state) => ({ keybindings: { ...state.keybindings, [id]: bindings } }))
    }),
    resetKeybindingOverride: vi.fn(async (id: string) => {
      useAppStore.setState((state) => {
        const next = { ...state.keybindings }
        delete next[id]
        return { keybindings: next }
      })
    })
  }))
  return { useAppStore }
})
vi.mock('@/store/plugins/catalog/plugin-contribution-catalog', () => ({
  useEditablePluginCommands: () => []
}))
vi.mock('../settings/shortcuts/use-mac-captured-digit-chords', () => ({
  useMacCapturedDigitChords: () => []
}))

beforeEach(() => {
  vi.stubGlobal('api', {})
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { ui: { setShortcutRecorderFocused: vi.fn() } }
  })
  useAppStore.setState({ keybindings: {}, keybindingSnapshot: null })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const mount = () =>
  render(
    <TooltipProvider>
      <AgentHubShortcutSetting />
    </TooltipProvider>
  )
const addHub = () => screen.getByRole('button', { name: 'Add shortcut for Toggle Agent Hub' })

function record(
  key: string,
  code: string,
  options: { ctrlKey?: boolean; metaKey?: boolean } = { ctrlKey: true }
) {
  fireEvent.click(addHub())
  fireEvent.keyDown(
    screen.getByRole('button', { name: /Press shortcut keys for Toggle Agent Hub/ }),
    { key, code, ...options }
  )
}

describe('inline Agent Hub shortcuts', () => {
  it('records, appends, replaces and removes through the shared binding store', async () => {
    mount()
    record('u', 'KeyU')
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggle']).toEqual(['Mod+U'])
    )
    record('F8', 'F8')
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggle']).toEqual(['Mod+U', 'Mod+F8'])
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Change shortcut 1 of 2 for Toggle Agent Hub' })
    )
    fireEvent.keyDown(
      screen.getByRole('button', { name: /Press shortcut keys for Toggle Agent Hub/ }),
      { key: 'F9', code: 'F9', ctrlKey: true }
    )
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggle']).toEqual(['Mod+F9', 'Mod+F8'])
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove Toggle Agent Hub shortcut 1' }))
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggle']).toEqual(['Mod+F8'])
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove Toggle Agent Hub shortcut 1' }))
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggle']).toBeUndefined()
    )
  })
  it('blocks a conflict without changing the binding and Escape cancels the recorder', async () => {
    mount()
    record('p', 'KeyP')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('conflicts with'))
    expect(useAppStore.getState().keybindings['agentHub.toggle']).toBeUndefined()
    fireEvent.keyDown(
      screen.getByRole('button', { name: /Press shortcut keys for Toggle Agent Hub/ }),
      { key: 'Escape' }
    )
    expect(addHub().getAttribute('aria-pressed')).toBe('false')
    expect(window.api.ui.setShortcutRecorderFocused).toHaveBeenLastCalledWith(false)
  })
  it('records a modifier double tap using the existing recorder', async () => {
    mount()
    fireEvent.click(addHub())
    const button = screen.getByRole('button', { name: /Press shortcut keys for Toggle Agent Hub/ })
    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(button, { key: 'Control', code: 'ControlLeft', ctrlKey: true })
      fireEvent.keyUp(button, { key: 'Control', code: 'ControlLeft', ctrlKey: false })
    }
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggle']).toEqual(['DoubleTap+Mod'])
    )
  })
  it('applies suggestions only to missing actions', async () => {
    useAppStore.setState({ keybindings: { 'agentHub.toggle': ['DoubleTap+Alt'] } })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Use these' })).toBeNull())
    expect(useAppStore.getState().keybindings['agentHub.toggle']).toEqual(['DoubleTap+Alt'])
    for (const [id, binding] of AGENT_HUB_SUGGESTED_BINDINGS.slice(1)) {
      expect(useAppStore.getState().keybindings[id]).toEqual([binding])
    }
  })
  it('preflights all suggestions so a late collision applies none', async () => {
    useAppStore.setState({
      keybindings: { 'worktree.quickOpen': [AGENT_HUB_SUGGESTED_BINDINGS[4][1]] }
    })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('conflicts with'))
    for (const [id] of AGENT_HUB_SUGGESTED_BINDINGS) {
      expect(useAppStore.getState().keybindings[id]).toBeUndefined()
    }
  })
  it('surfaces save failures and releases the global recording flag on unmount', async () => {
    vi.mocked(useAppStore.getState().setKeybindingOverride).mockRejectedValueOnce(
      new Error('disk full')
    )
    const view = mount()
    record('u', 'KeyU')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('disk full'))
    act(() => view.unmount())
    expect(window.api.ui.setShortcutRecorderFocused).toHaveBeenLastCalledWith(false)
  })
})
