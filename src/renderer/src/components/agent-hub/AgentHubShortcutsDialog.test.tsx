/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { KeybindingOverrides } from '../../../../shared/keybindings/types'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubShortcutsButton, AgentHubShortcutsDialog } from './AgentHubShortcutsDialog'
import { AgentHubDockMenu } from './AgentHubDockMenu'
import { setAgentHubShortcutsOpen } from './agent-hub-shortcuts-dialog'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const bindings: KeybindingOverrides = {}
  const useAppStore = create(() => ({
    keybindings: bindings,
    settings: {},
    keybindingSnapshot: null,
    setKeybindingOverride: vi.fn(async (id: string, values: string[]) => {
      useAppStore.setState((state) => ({ keybindings: { ...state.keybindings, [id]: values } }))
    }),
    resetKeybindingOverride: vi.fn(),
    updateSettings: vi.fn()
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
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { ui: { setShortcutRecorderFocused: vi.fn() } }
  })
})
afterEach(() => {
  cleanup()
  setAgentHubShortcutsOpen(false)
  useAppStore.setState({ keybindings: {} })
  vi.clearAllMocks()
})
function mount() {
  return render(
    <TooltipProvider>
      <AgentHubShortcutsButton />
      <AgentHubShortcutsDialog />
      <AgentHubDockMenu
        edge="bottom"
        size="medium"
        muted={false}
        onOpenChange={vi.fn()}
        buttonClassName=""
      />
    </TooltipProvider>
  )
}
describe('Agent Hub shortcuts help', () => {
  it('edits an unbound action from the dock menu without leaving the dialog', async () => {
    useAppStore.setState({ keybindings: { 'agentHub.toggleOrb': [] } })
    mount()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
      button: 0,
      ctrlKey: false
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Keyboard shortcuts' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Add shortcut for Toggle Agent Hub Orb' }))
    fireEvent.keyDown(
      screen.getByRole('button', { name: /Press shortcut keys for Toggle Agent Hub Orb/ }),
      { key: 'F8', code: 'F8', ctrlKey: true }
    )
    await waitFor(() =>
      expect(useAppStore.getState().keybindings['agentHub.toggleOrb']).toEqual(['Mod+F8'])
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
