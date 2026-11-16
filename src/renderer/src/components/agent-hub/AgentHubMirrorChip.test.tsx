/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as MirrorSource from './agent-hub-mirror-source'
import { TooltipProvider } from '../ui/tooltip'
import { makeTabWithIds, PANE_KEY } from '../activity/ActivityPrototypePage-test-fixtures'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { AgentHubMirrorChip } from './AgentHubMirrorChip'
import { AgentHubMirrorMicButton } from './AgentHubMirrorMicButton'
import { paneTargetFromThread } from './agent-hub-pane-target'
import { activeAgentHubMirrorTab } from './agent-hub-mirror-membership'
import { addAgentHubMirrorTab, activateAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  minimizeAgentHubMirror,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import type { AgentHubAlert } from './agent-hub-alerts'
import type * as QuickAnswer from './use-agent-hub-quick-answer'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      settings: {},
      keybindings: {},
      tabsByWorktree: {},
      unifiedTabsByWorktree: {},
      activeView: 'terminal',
      activeWorktreeId: null
    }))
  }
})
// The chip's bubbles are not about answering; the answer path needs the live pane and PTY.
vi.mock('./use-agent-hub-quick-answer', async (original) => ({
  ...(await original<typeof QuickAnswer>()),
  useAgentHubQuickAnswer: () => ({
    question: null,
    options: [],
    chosen: null,
    canAnswer: false,
    choose: () => false,
    reply: null
  })
}))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (
    target: Parameters<typeof MirrorSource.resolveAgentHubMirrorTarget>[0]
  ) => target
}))
vi.mock('./use-agent-hub-mirror-mic-state', () => ({
  useAgentHubMirrorMicState: () => 'elsewhere'
}))
vi.mock('./AgentHubMirrorMicMenu', () => ({
  AgentHubMirrorMicMenu: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('./agent-hub-dictation-origin', () => ({
  useAgentHubDictationSession: () => ({ pane: { tabId: 'waiting-source', leafId: null } })
}))
vi.mock('./agent-hub-dictation-capabilities', () => ({
  readAgentHubDictationCapabilities: () => ({ improve: false })
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.unstubAllGlobals()
})

function fixture() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    }
  )
  const first = agentHubThreadsFor([{ paneKey: PANE_KEY, state: 'working', at: 1000 }])[0]
  const waiting = {
    ...first,
    tab: makeTabWithIds('waiting-source', first.worktree.id),
    paneKey: 'waiting-source:leaf'
  }
  openAgentHubMirror(paneTargetFromThread(first, 'Active source'))
  const window = readAgentHubMirrors().windows[0]
  addAgentHubMirrorTab(window.id, paneTargetFromThread(waiting, 'Waiting source'))
  activateAgentHubMirrorTab(window.id, window.activeTabId)
  minimizeAgentHubMirror(window.id)
  const alert: AgentHubAlert = { id: 'inactive-alert', kind: 'done', thread: waiting }
  const restore = vi.fn(),
    reveal = vi.fn(),
    dismiss = vi.fn()
  render(
    <TooltipProvider>
      <AgentHubMirrorChip
        chip={readAgentHubMirrors().chips[0]}
        thread={first}
        kind="done"
        location={{ group: null, project: 'Project', workspace: null }}
        alert={alert}
        alertSide="top"
        onRestore={restore}
        onReveal={reveal}
        onClose={vi.fn()}
        onOpenAlert={vi.fn()}
        onDismissAlert={dismiss}
      />
    </TooltipProvider>
  )
  return { window, waiting, alert, restore, reveal, dismiss }
}
it('restores the grouped chip normally without changing its saved active entry', () => {
  const { window, restore } = fixture()
  expect(screen.getByText('2 tabs')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Restore Active source' }))
  expect(restore).toHaveBeenCalledOnce()
  expect(readAgentHubMirrors().chips[0].window.activeTabId).toBe(window.activeTabId)
})
it('an inactive member alert selects that member on pop-out and identifies it on Jump', () => {
  const { window, waiting, alert, restore, reveal, dismiss } = fixture()
  const jump = screen.getAllByRole('button', { name: 'Jump to this terminal in its workspace' })
  fireEvent.click(jump[1])
  expect(reveal).toHaveBeenCalledWith(alert)
  fireEvent.click(screen.getByRole('button', { name: 'Own window' }))
  const reopened = readAgentHubMirrors().windows[0]
  expect(reopened.id).toBe(window.id)
  expect(activeAgentHubMirrorTab(reopened).target.paneKey).toBe(waiting.paneKey)
  expect(reopened.tabs).toHaveLength(2)
  expect(restore).not.toHaveBeenCalled()
  expect(dismiss).toHaveBeenCalledWith(alert.id)
})

it('names a dictation owner in an inactive entry of a parked window', () => {
  fixture()
  const target = activeAgentHubMirrorTab(readAgentHubMirrors().chips[0].window).target
  render(
    <TooltipProvider>
      <AgentHubMirrorMicButton target={target} reachable />
    </TooltipProvider>
  )
  expect(screen.getByRole('button', { name: /Waiting source/ }).getAttribute('aria-disabled')).toBe(
    'true'
  )
})
