/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import { AgentHubDock } from './AgentHubDock'
import { AgentHubMirrorHeaderControls } from './AgentHubMirrorHeaderControls'
import { requestAgentHubMirrorsDock } from './agent-hub-mirror-store'

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ settings: {}, keybindings: {}, updateSettings: vi.fn() })
}))
vi.mock('./use-dock-bar-motion', () => ({ useDockBarMotion: () => ({ size: null, rest: null }) }))
vi.mock('./use-viewport-size', () => ({ useViewportSize: () => ({ width: 1000, height: 800 }) }))
vi.mock('./use-agent-hub-terminal-counts', () => ({
  useAgentHubTerminalCounts: () => ({ agents: 0, all: 0 })
}))
vi.mock('./AgentHubDockMenu', () => ({ AgentHubDockMenu: () => null }))
vi.mock('./AgentHubMirrorMicButton', () => ({ AgentHubMirrorMicButton: () => null }))
vi.mock('./AgentHubDimToggle', () => ({ AgentHubDimToggle: () => null }))
vi.mock('./AgentHubMirrorFocusButton', () => ({ AgentHubMirrorFocusButton: () => null }))
vi.mock('./agent-hub-mirror-store', () => ({
  requestAgentHubMirrorsDock: vi.fn(),
  agentHubMirrorWindowCap: () => 4
}))
vi.mock('./agent-hub-floating-arrangement', () => ({
  arrangeAgentHubFloatingWindowsByDefault: vi.fn(),
  arrangeAgentHubFloatingWindowsOnScreen: vi.fn()
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('only the dock Arrange button opens a layout menu; the pop-out button remains a click toggle', async () => {
  const toggle = vi.fn()
  render(
    <TooltipProvider>
      <AgentHubDock
        position={{ edge: 'bottom', offset: 0.5 }}
        size="medium"
        counts={{ working: 0, needsYou: 0, finished: 0 }}
        muted={false}
        pinned
        mirrors={{ windows: 1, chips: 0 }}
        canvas={null}
        flushTop={false}
        terminals={{ threads: [], includeShells: true, parentOf: new Map() }}
        onOpenTab={vi.fn()}
        onNextWaiting={vi.fn()}
        onToggleMirrors={toggle}
        onMove={vi.fn()}
      />
    </TooltipProvider>
  )
  const popOut = screen.getByRole('button', { name: 'Send the mirrors to the hub' })
  fireEvent.contextMenu(popOut)
  expect(screen.queryByRole('menu')).toBeNull()
  expect(toggle).not.toHaveBeenCalled()
  fireEvent.click(popOut)
  expect(toggle).toHaveBeenCalledOnce()
  fireEvent.contextMenu(screen.getByRole('button', { name: 'Arrange mirrors' }))
  expect(await screen.findByRole('menuitemradio', { name: 'In a grid' })).toBeTruthy()
})

it('the mirror header sends back on click without a custom right-click menu', () => {
  const worktree = makeWorktree()
  render(
    <TooltipProvider>
      <AgentHubMirrorHeaderControls
        target={{
          tab: makeTabWithIds('pop-out-tab', worktree.id),
          worktree,
          repo: makeRepo(),
          paneKey: null,
          title: 'Terminal',
          agentType: null
        }}
        reachable
        mirrorKey="pop-out-tab"
        focused={false}
        onReveal={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
        onCloseAgent={vi.fn()}
        isAgent={false}
      />
    </TooltipProvider>
  )
  const popOut = screen.getByRole('button', { name: 'Send all mirrors to the hub' })
  fireEvent.contextMenu(popOut)
  expect(screen.queryByRole('menu')).toBeNull()
  expect(requestAgentHubMirrorsDock).not.toHaveBeenCalled()
  fireEvent.click(popOut)
  expect(requestAgentHubMirrorsDock).toHaveBeenCalledOnce()
})
