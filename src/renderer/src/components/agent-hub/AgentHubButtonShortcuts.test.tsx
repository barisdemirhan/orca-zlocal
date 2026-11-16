/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeybindingOverrides } from '../../../../shared/keybindings/types'
import { useAppStore } from '@/store'
import { TooltipProvider } from '../ui/tooltip'
import {
  makeActivityResult,
  makeRepo,
  makeTab,
  makeThreads,
  makeWorkingEntryWithoutHistory,
  makeWorktree,
  PANE_KEY
} from '../activity/ActivityPrototypePage-test-fixtures'
import { AgentHubMirrorHeaderControls } from './AgentHubMirrorHeaderControls'
import { AgentHubThreadHoverCard } from './AgentHubThreadHoverCard'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const keybindings: KeybindingOverrides = {}
  return {
    useAppStore: create(() => ({
      keybindings,
      terminalLayoutsByTabId: {},
      ptyIdsByTabId: {},
      sleepingAgentSessionsByPaneKey: {},
      agentStatusByPaneKey: {},
      tabsByWorktree: {}
    }))
  }
})
vi.mock('./AgentHubMirrorMicButton', () => ({ AgentHubMirrorMicButton: () => null }))
vi.mock('./AgentHubDimToggle', () => ({ AgentHubDimToggle: () => null }))
vi.mock('./AgentHubMirrorFocusButton', () => ({ AgentHubMirrorFocusButton: () => null }))
afterEach(cleanup)

async function renderAction(
  surface: 'mirror' | 'hover-card' | 'hover-card-jump',
  onClick = vi.fn()
) {
  if (surface === 'mirror') {
    render(
      <TooltipProvider delayDuration={0}>
        <AgentHubMirrorHeaderControls
          target={{
            tab: makeTab(),
            worktree: makeWorktree(),
            repo: makeRepo(),
            paneKey: null,
            title: 'Terminal',
            agentType: null
          }}
          reachable
          mirrorKey="tab-1"
          focused={false}
          onReveal={onClick}
          onMinimize={vi.fn()}
          onClose={vi.fn()}
          onCloseAgent={vi.fn()}
          isAgent={false}
        />
      </TooltipProvider>
    )
    return screen.getByRole('button', { name: 'Jump' })
  }
  const thread = makeThreads(
    makeActivityResult({ entries: { [PANE_KEY]: makeWorkingEntryWithoutHistory() } })
  )[0]
  if (!thread) {
    throw new Error('Expected a working agent fixture')
  }
  render(
    <TooltipProvider delayDuration={0}>
      <AgentHubThreadHoverCard
        thread={thread}
        location={{ group: null, project: 'Orca', workspace: null }}
        actions={
          surface === 'hover-card'
            ? { onPopout: onClick }
            : { onJump: onClick, showJumpShortcut: true }
        }
      >
        <button>Agent details</button>
      </AgentHubThreadHoverCard>
    </TooltipProvider>
  )
  fireEvent.pointerEnter(screen.getByRole('button', { name: 'Agent details' }), {
    pointerType: 'mouse'
  })
  return screen.findByRole('button', { name: surface === 'hover-card' ? 'Own window' : 'Jump' })
}

describe.each([
  { surface: 'mirror', actionId: 'agentHub.jumpToMirror', key: 'F6', label: '' },
  { surface: 'hover-card', actionId: 'agentHub.popOut', key: 'F7', label: 'Own window' },
  { surface: 'hover-card-jump', actionId: 'agentHub.jumpToMirror', key: 'F8', label: 'Jump' }
] as const)('$surface button shortcuts', ({ surface, actionId, key, label }) => {
  it.each(['hover', 'focus'] as const)(
    'shows its bound shortcut only on %s',
    async (interaction) => {
      useAppStore.setState({ keybindings: { [actionId]: [`Mod+${key}`] } })
      const button = await renderAction(surface)
      expect(button.textContent).toBe(label)
      expect(screen.queryByText(key)).toBeNull()
      expect(screen.queryByRole('tooltip')).toBeNull()
      if (interaction === 'hover') {
        fireEvent.pointerMove(button, { pointerType: 'mouse' })
      } else {
        fireEvent.focus(button)
      }
      await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain(key))
      expect(button.textContent).toBe(label)
    }
  )
  it('keeps unbound actions plain and preserves their click handler', async () => {
    useAppStore.setState({ keybindings: {} })
    const onClick = vi.fn()
    const button = await renderAction(surface, onClick)
    expect(button.textContent).toBe(label)
    fireEvent.focus(button)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).not.toMatch(/F6|F7|F8|↵/)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
