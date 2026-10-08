/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import {
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { AgentHubMirrorFamilyTabs } from './AgentHubMirrorFamilyTabs'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import { setAgentHubHiddenFamilyBars } from './agent-hub-family-bar'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  useAgentHubMirrors
} from './agent-hub-mirror-store'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({ keybindings: {}, tabsByWorktree: {}, setTabCustomTitle: vi.fn() }))
  }
})
vi.mock('./AgentHubMirrorAddButton', () => ({ AgentHubMirrorAddButton: () => null }))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  setAgentHubHiddenFamilyBars([])
  vi.restoreAllMocks()
})

// Dispatcher (tab-1) → workers (tab-2, tab-3).
const threads = agentHubThreadsFor([
  { paneKey: PANE_KEY, state: 'working', at: 1_000 },
  { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY },
  { paneKey: PANE_KEY_3, state: 'done', at: 1_000, parentPaneKey: PANE_KEY }
])
const lineage = buildAgentHubLineage(threads, 1_000)
const location = { group: null, project: 'Project', workspace: 'ws', host: 'Local Mac' }

function dispatcherTarget(): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds('tab-1', worktree.id),
    paneKey: PANE_KEY,
    title: 'Dispatcher',
    agentType: 'claude'
  }
}

function Stage(): React.JSX.Element {
  const { windows } = useAgentHubMirrors()
  const family = agentHubMirrorFamily(PANE_KEY, threads, lineage)
  return (
    <TooltipProvider>
      {windows.map((window) => (
        <div key={window.id} data-agent-hub-mirror>
          <AgentHubMirrorTabStrip
            window={window}
            threads={threads}
            lineage={lineage}
            locationOf={() => location}
            onReveal={vi.fn()}
          />
          {family ? (
            <AgentHubMirrorFamilyTabs
              family={family}
              activeKey={PANE_KEY}
              locationOf={() => location}
              actionsFor={() => ({})}
              onSelect={vi.fn()}
            />
          ) : null}
        </div>
      ))}
    </TooltipProvider>
  )
}

function stage(): HTMLElement {
  openAgentHubMirror(dispatcherTarget())
  render(<Stage />)
  return screen.getByRole('tab')
}

it('shows the workers disclosure on the active tab and folds the bar with it', () => {
  stage()
  const toggle = screen.getByRole('button', { name: 'Hide the workers bar' })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(toggle)
  expect(
    screen.getByRole('button', { name: 'Show the workers bar' }).getAttribute('aria-expanded')
  ).toBe('false')
})

it('has no disclosure for a tab without a family', () => {
  const worktree = makeWorktree()
  openAgentHubMirror({
    worktree,
    repo: null,
    tab: makeTabWithIds('other', worktree.id),
    paneKey: null,
    title: 'other',
    agentType: null
  })
  render(<Stage />)
  expect(screen.queryByRole('button', { name: /workers bar/ })).toBeNull()
})

it('ArrowUp on the tab hides the bar and ArrowDown shows it and enters the tree', async () => {
  const tab = stage()
  tab.focus()
  fireEvent.keyDown(tab, { key: 'ArrowUp' })
  expect(screen.getByRole('button', { name: 'Show the workers bar' })).toBeTruthy()
  fireEvent.keyDown(tab, { key: 'ArrowDown' })
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
  expect(screen.getByRole('button', { name: 'Hide the workers bar' })).toBeTruthy()
  const rows = screen.getAllByRole('treeitem')
  expect(document.activeElement).toBe(rows[0])
})

it('roves between rows, returns to the tab at the top and on Escape', async () => {
  const tab = stage()
  const user = userEvent.setup()
  tab.focus()
  await user.keyboard('{ArrowDown}')
  const rows = screen.getAllByRole('treeitem')
  expect(rows).toHaveLength(2)
  expect(document.activeElement).toBe(rows[0])
  await user.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(rows[1])
  await user.keyboard('{ArrowUp}{ArrowUp}')
  expect(document.activeElement).toBe(tab)
  await user.keyboard('{ArrowDown}{Escape}')
  expect(document.activeElement).toBe(tab)
  expect(readAgentHubMirrors().windows).toHaveLength(1)
})

it('Enter on a row selects it', async () => {
  const onSelect = vi.fn()
  const family = agentHubMirrorFamily(PANE_KEY, threads, lineage)
  if (!family) {
    throw new Error('No family')
  }
  const user = userEvent.setup()
  render(
    <AgentHubMirrorFamilyTabs
      family={family}
      activeKey={PANE_KEY}
      locationOf={() => location}
      actionsFor={() => ({})}
      onSelect={onSelect}
    />
  )
  screen.getAllByRole('treeitem')[0]?.focus()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ paneKey: PANE_KEY_3 }))
})

it('shows the agent card on hovering a tab, and closes it on press', async () => {
  const tab = stage()
  const user = userEvent.setup()
  await user.hover(tab)
  expect(await screen.findByText('Where')).toBeTruthy()
  expect(screen.getAllByText('Local Mac').length).toBeGreaterThan(1)
  await user.pointer({ keys: '[MouseLeft>]', target: tab })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200))
  })
  expect(screen.queryByText('Where')).toBeNull()
})
