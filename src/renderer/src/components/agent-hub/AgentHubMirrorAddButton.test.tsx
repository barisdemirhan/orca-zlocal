/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import { buildAgentHubTerminalTree, type AgentHubGroupNode } from './agent-hub-terminal-tree'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { AgentHubMirrorAddButton } from './AgentHubMirrorAddButton'
import {
  openAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import type * as MirrorSource from './agent-hub-mirror-source'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { paneTargetFromTerminalRow } from './agent-hub-pane-target'

const fixture = vi.hoisted(() => ({
  groups: Array<AgentHubGroupNode>(),
  disappeared: new Set<string>()
}))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return { useAppStore: create(() => ({ tabsByWorktree: {}, activeView: 'activity' })) }
})
vi.mock('./use-agent-hub-terminal-tree', () => ({ useAgentHubTerminalTree: () => fixture.groups }))
vi.mock('./use-agent-hub-tree-order', () => ({
  useAgentHubTreeOrder: () => ({ sortBy: 'repo', workspaceRank: new Map(), now: 0 })
}))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) =>
    fixture.disappeared.has(target.tab.id) ? null : target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  fixture.disappeared.clear()
})
function setup() {
  const worktree = makeWorktree()
  fixture.groups = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [],
    worktreesByRepo: { [worktree.repoId]: [worktree] },
    folderWorkspaces: [],
    tabsByWorktree: {
      [worktree.id]: ['home', 'other', 'available', 'later'].map((id) =>
        makeTabWithIds(id, worktree.id, id)
      )
    },
    threads: [],
    floating: null,
    includeShells: true,
    idleAgentOf: () => 'claude',
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Project'
  })
  const rows = fixture.groups[0]?.workspaces[0]?.rows
  const home = rows?.[0],
    other = rows?.[1]
  if (!home || !other) {
    throw new Error('No fixture')
  }
  openAgentHubMirror(paneTargetFromTerminalRow(home))
  const id = readAgentHubMirrors().windows[0]?.id
  if (!id) {
    throw new Error('No window')
  }
  openAgentHubMirror(paneTargetFromTerminalRow(other))
  const onEscape = vi.fn()
  render(
    <TooltipProvider>
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            onEscape()
          }
        }}
      >
        <AgentHubMirrorAddButton
          windowId={id}
          count={1}
          threads={[]}
          lineage={EMPTY_AGENT_HUB_LINEAGE}
        />
      </div>
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add terminal to this mirror' }))
  return { id, onEscape }
}
it('searches only globally available rows and adds/selects one in this window', async () => {
  const { id } = setup()
  const search = await screen.findByRole('textbox', { name: 'Filter terminals' })
  expect(screen.queryByRole('option', { name: /home/ })).toBeNull()
  expect(screen.queryByRole('option', { name: /other/ })).toBeNull()
  fireEvent.change(search, { target: { value: 'available' } })
  fireEvent.keyDown(search, { key: 'ArrowDown' })
  fireEvent.keyDown(search, { key: 'Enter' })
  const window = readAgentHubMirrors().windows.find((window) => window.id === id)
  expect(window?.tabs).toHaveLength(2)
  expect(window?.tabs.find((tab) => tab.id === window.activeTabId)?.target.tab.id).toBe('available')
  await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
})
it('clears the query on first Escape, dismisses picker on second, and never closes mirror chrome', async () => {
  const { onEscape } = setup()
  const search = await screen.findByRole('textbox')
  fireEvent.change(search, { target: { value: 'missing' } })
  fireEvent.keyDown(search, { key: 'Escape' })
  expect(search instanceof HTMLInputElement ? search.value : null).toBe('')
  expect(screen.getByRole('textbox')).toBeTruthy()
  fireEvent.keyDown(search, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  expect(onEscape).not.toHaveBeenCalled()
})
it('rejects a source disappearing after the picker opened', async () => {
  const { id } = setup()
  const search = await screen.findByRole('textbox')
  fireEvent.change(search, { target: { value: 'available' } })
  fixture.disappeared.add('available')
  fireEvent.keyDown(search, { key: 'ArrowDown' })
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(readAgentHubMirrors().windows.find((window) => window.id === id)?.tabs).toHaveLength(1)
  expect(screen.getByRole('textbox')).toBeTruthy()
})
it('removes a newly reserved selection under live churn rather than adding a duplicate', async () => {
  const { id } = setup()
  const search = await screen.findByRole('textbox')
  fireEvent.change(search, { target: { value: 'available' } })
  fireEvent.keyDown(search, { key: 'ArrowDown' })
  const row = fixture.groups[0]?.workspaces[0]?.rows.find((row) => row.tab.id === 'available')
  if (!row) {
    throw new Error('No row')
  }
  act(() => openAgentHubMirror(paneTargetFromTerminalRow(row)))
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(readAgentHubMirrors().windows.find((window) => window.id === id)?.tabs).toHaveLength(1)
  expect(screen.queryByRole('option', { name: /available/ })).toBeNull()
})
it('keeps search present when no terminal is available and disables the full-window button with a reason', () => {
  const { id } = setup()
  cleanup()
  render(
    <TooltipProvider>
      <AgentHubMirrorAddButton
        windowId={id}
        count={10}
        threads={[]}
        lineage={EMPTY_AGENT_HUB_LINEAGE}
      />
    </TooltipProvider>
  )
  expect(
    screen
      .getByRole('button', { name: 'A mirror can hold up to 10 terminals.' })
      .hasAttribute('disabled')
  ).toBe(true)
})

it('switches picker sections with arrow keys and links keyboard selection to the available option', async () => {
  setup()
  const user = userEvent.setup()
  const agents = screen.getByRole('tab', { name: 'Agents' })
  agents.focus()
  await user.keyboard('{ArrowRight}')
  const all = screen.getByRole('tab', { name: 'All terminals' })
  expect(document.activeElement).toBe(all)
  expect(all.getAttribute('aria-selected')).toBe('true')
  expect(agents.tabIndex).toBe(-1)
  const panelId = all.getAttribute('aria-controls')
  expect(panelId && document.getElementById(panelId)?.getAttribute('role')).toBe('tabpanel')
  const search = screen.getByRole('textbox')
  search.focus()
  fireEvent.change(search, { target: { value: 'available' } })
  await user.keyboard('{ArrowDown}')
  const selectedId = search.getAttribute('aria-activedescendant')
  expect(selectedId && document.getElementById(selectedId)?.getAttribute('aria-selected')).toBe(
    'true'
  )
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
})
