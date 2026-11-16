/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeybindingOverrides } from '../../../../shared/keybindings/types'
import { act } from 'react'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import { AgentHubActionTooltip, AgentHubShortcut } from './AgentHubShortcut'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const initialBindings: KeybindingOverrides = {}
  return { useAppStore: create(() => ({ keybindings: initialBindings })) }
})
afterEach(cleanup)

describe('Agent Hub shortcut hints', () => {
  it('hides unbound and unknown sibling actions in every slot', () => {
    useAppStore.setState({ keybindings: {} })
    const { container } = render(
      <>
        <AgentHubShortcut actionId="agentHub.focusMirror" />
        <AgentHubShortcut actionId="voice.dictationImprove" slot="context" />
        <AgentHubShortcut actionId="agentHub.popOut" slot="dropdown" />
      </>
    )
    expect(container.innerHTML).toBe('')
  })
  it('uses the primitives shortcut slots and reflects binding edits', () => {
    useAppStore.setState({ keybindings: { 'agentHub.focusMirror': ['Mod+F12'] } })
    const { container } = render(
      <AgentHubShortcut actionId="agentHub.focusMirror" slot="context" />
    )
    expect(container.querySelector('[data-slot="context-menu-shortcut"]')?.textContent).toContain(
      'F12'
    )
    act(() => useAppStore.setState({ keybindings: { 'agentHub.focusMirror': [] } }))
    expect(container.innerHTML).toBe('')
  })
  it('shows the bound combination on keyboard focus in a tooltip', async () => {
    useAppStore.setState({ keybindings: { 'agentHub.focusMirror': ['Mod+F12'] } })
    render(
      <TooltipProvider>
        <AgentHubActionTooltip label="Focus this mirror" actionId="agentHub.focusMirror">
          <button>Focus</button>
        </AgentHubActionTooltip>
      </TooltipProvider>
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Focus' }))
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain('F12'))
  })
})
