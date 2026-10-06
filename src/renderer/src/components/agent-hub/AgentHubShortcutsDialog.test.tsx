/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { KEYBINDING_DEFINITIONS, type KeybindingOverrides } from '../../../../shared/keybindings'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubShortcutsButton, AgentHubShortcutsDialog } from './AgentHubShortcutsDialog'
import { AgentHubDockMenu } from './AgentHubDockMenu'
import { setAgentHubShortcutsOpen } from './agent-hub-shortcuts-dialog'

const navigation = vi.hoisted(() => ({ target: vi.fn(), page: vi.fn() }))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const bindings: KeybindingOverrides = {}
  return {
    useAppStore: create(() => ({
      keybindings: bindings,
      openSettingsTarget: navigation.target,
      openSettingsPage: navigation.page,
      updateSettings: vi.fn()
    }))
  }
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
  it('opens from the header, lists every hub action and current bindings, and closes with Escape', async () => {
    useAppStore.setState({ keybindings: { 'agentHub.focusMirror': ['Mod+F12'] } })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }))
    const dialog = await screen.findByRole('dialog')
    for (const action of KEYBINDING_DEFINITIONS.filter((entry) =>
      entry.id.startsWith('agentHub.')
    )) {
      expect(dialog.querySelector(`[data-agent-hub-shortcut-help="${action.id}"]`)).not.toBeNull()
    }
    expect(
      dialog.querySelector('[data-agent-hub-shortcut-help="agentHub.focusMirror"]')?.textContent
    ).toContain('F12')
    expect(
      dialog.querySelector('[data-agent-hub-shortcut-help="agentHub.popOut"]')?.textContent
    ).toContain('Not set')
    expect(dialog.textContent).toContain('double tap of a modifier key')
    expect(
      dialog.querySelector('[data-agent-hub-shortcut-help="voice.dictationImprove"]')
    ).toBeNull()
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it('opens from the dock menu and sends an unbound action to Agent Hub settings', async () => {
    mount()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
      button: 0,
      ctrlKey: false
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Keyboard shortcuts' }))
    await screen.findByRole('dialog')
    fireEvent.click(
      screen.getByRole('button', { name: 'Set shortcut for Pop out the active agent' })
    )
    expect(navigation.target).toHaveBeenCalledWith({
      pane: 'experimental',
      repoId: null,
      sectionId: 'experimental-agent-hub'
    })
    expect(navigation.page).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
  it('updates displayed bindings while open', async () => {
    mount()
    act(() => setAgentHubShortcutsOpen(true))
    const dialog = await screen.findByRole('dialog')
    act(() => useAppStore.setState({ keybindings: { 'agentHub.popOut': ['Mod+F7'] } }))
    expect(
      dialog.querySelector('[data-agent-hub-shortcut-help="agentHub.popOut"]')?.textContent
    ).toContain('F7')
    expect(
      screen.queryByRole('button', { name: 'Set shortcut for Pop out the active agent' })
    ).toBeNull()
  })
})
