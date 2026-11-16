import { acceptedAgentStatuses } from '@/store/slices/agent-status/accepted-agent-statuses'
/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import { makeTabWithIds, makeWorktree } from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { addAgentHubMirrorTab, toggleAgentHubMirrorTabPin } from './agent-hub-mirror-tab-operations'
import {
  openAgentHubMirror,
  useAgentHubMirrors,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest,
  commitAgentHubMirrorState
} from './agent-hub-mirror-store'
import {
  requestAgentHubMirrorSelection,
  useAgentHubMirrorSelection
} from './agent-hub-mirror-selection'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      keybindings: {},
      tabsByWorktree: {},
      unifiedTabsByWorktree: {},
      setTabCustomTitle: vi.fn(),
      terminalLayoutsByTabId: {},
      ptyIdsByTabId: {},
      sleepingAgentSessionsByPaneKey: {},
      agentStatusByPaneKey: acceptedAgentStatuses()
    }))
  }
})
vi.mock('./AgentHubMirrorAddButton', () => ({
  AgentHubMirrorAddButton: ({ count }: { count: number }) => (
    <button disabled={count === 10}>Add</button>
  )
}))
vi.mock('./agent-hub-mirror-source', async (original) => ({
  ...(await original<typeof MirrorSource>()),
  resolveAgentHubMirrorTarget: (target: AgentHubPaneTarget) => target
}))
afterEach(() => {
  cleanup()
  resetAgentHubMirrorsForTest()
  vi.restoreAllMocks()
})
function target(id: string, agentType: AgentHubPaneTarget['agentType'] = null): AgentHubPaneTarget {
  const worktree = makeWorktree()
  return {
    worktree,
    repo: null,
    tab: makeTabWithIds(id, worktree.id),
    paneKey: null,
    title: id,
    agentType
  }
}
function stage(count = 3, onReveal = vi.fn(), agentType: AgentHubPaneTarget['agentType'] = null) {
  openAgentHubMirror(target('one', agentType))
  const id = readAgentHubMirrors().windows[0]?.id
  if (!id) {
    throw new Error('No window')
  }
  for (let i = 1; i < count; i++) {
    addAgentHubMirrorTab(id, target(`entry-${i}`, agentType))
  }
  function Stage(): React.JSX.Element {
    const { windows } = useAgentHubMirrors()
    const selection = useAgentHubMirrorSelection()
    return (
      <TooltipProvider>
        <output data-testid="focus-policy">{String(selection.focusTerminal)}</output>
        {windows.map((window) => (
          <AgentHubMirrorTabStrip
            key={window.id}
            window={window}
            threads={[]}
            lineage={EMPTY_AGENT_HUB_LINEAGE}
            locationOf={(target) => ({
              group: null,
              project: 'Project',
              workspace: target.tab.id,
              host: target.tab.id === 'one' ? 'Local Mac' : 'workhost'
            })}
            onReveal={onReveal}
          />
        ))}
      </TooltipProvider>
    )
  }
  render(<Stage />)
  return id
}

it('jumps an inactive tab to its own workspace from its menu and keeps the other tab', async () => {
  const reveal = vi.fn()
  stage(2, reveal)
  const inactive = screen.getByRole('tab', { name: 'one, idle' })
  expect(inactive.getAttribute('aria-selected')).toBe('false')
  fireEvent.contextMenu(inactive)
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Jump to this terminal in its workspace' })
  )
  expect(reveal).toHaveBeenCalledWith(target('one'), null)
  expect(readAgentHubMirrors().windows[0]?.tabs.map((tab) => tab.target.tab.id)).toEqual([
    'entry-1'
  ])
})

it('keeps a pinned inactive tab when Jump opens its workspace', async () => {
  const reveal = vi.fn()
  const windowId = stage(2, reveal)
  const tab = readAgentHubMirrors().windows[0]?.tabs.find((entry) => entry.target.tab.id === 'one')
  if (!tab) {
    throw new Error('No inactive tab')
  }
  act(() => toggleAgentHubMirrorTabPin(windowId, tab.id))
  fireEvent.contextMenu(screen.getByRole('tab', { name: 'one, idle' }))
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Jump to this terminal in its workspace' })
  )
  expect(reveal).toHaveBeenCalledWith(tab.target, null)
  expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
  expect(
    readAgentHubMirrors().windows[0]?.tabs.find((entry) => entry.id === tab.id)?.isPinned
  ).toBe(true)
})

it.each([
  { tabId: 'one', agentType: 'claude', host: 'Local Mac' },
  { tabId: 'entry-1', agentType: 'codex', host: 'workhost' },
  { tabId: 'one', agentType: null, host: 'Local Mac' }
] as const)(
  'keeps the hover workspace actions for an inactive $agentType tab on $host without status',
  async ({ tabId, agentType, host }) => {
    const reveal = vi.fn()
    stage(10, reveal, agentType)
    const tab = screen.getByRole('tab', { name: `${tabId}, idle` })
    const user = userEvent.setup()
    await user.hover(tab)
    const jump = await screen.findByRole('button', { name: 'Jump' })
    const card = jump.closest('[data-slot="hover-card-content"]')
    if (!(card instanceof HTMLElement)) {
      throw new Error('No tab hover card')
    }
    expect(within(card).getByText(host)).toBeTruthy()
    expect(tab.getAttribute('aria-selected')).toBe('false')
    await user.click(jump)
    expect(reveal).toHaveBeenCalledWith(target(tabId, agentType), null)
    expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(9)
  }
)

it('roves Left/Right/Home/End while preserving strip focus, and Enter requests terminal focus', () => {
  stage()
  const tabs = screen.getAllByRole('tab')
  const last = tabs.at(-1)
  if (!last) {
    throw new Error('No tab')
  }
  last.focus()
  fireEvent.keyDown(last, { key: 'Home' })
  expect(document.activeElement).toBe(tabs[0])
  expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
  expect(screen.getByTestId('focus-policy').textContent).toBe('false')
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowLeft' })
  expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(tabs[0])
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'End' })
  expect(document.activeElement).toBe(last)
  fireEvent.keyDown(last, { key: 'Enter' })
  expect(screen.getByTestId('focus-policy').textContent).toBe('true')
  expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
})
it('does not reveal the active tab during passive renders', () => {
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
  const id = stage()
  const before = scroll.mock.calls.length
  act(() => commitAgentHubMirrorState(readAgentHubMirrors()))
  act(() =>
    requestAgentHubMirrorSelection(
      id,
      readAgentHubMirrors().windows[0]?.activeTabId ?? '',
      false,
      false
    )
  )
  expect(scroll.mock.calls.length).toBe(before)
})
it('returns entries home and removes individual close buttons once only one remains', () => {
  stage()
  const active = readAgentHubMirrors().windows[0]?.activeTabId
  fireEvent.click(screen.getByRole('button', { name: 'Close mirror tab one' }))
  expect(readAgentHubMirrors().windows[0]?.activeTabId).toBe(active)
  fireEvent.click(screen.getByRole('button', { name: 'Close mirror tab entry-2' }))
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.target.title).toBe('entry-1')
  expect(screen.queryByRole('button', { name: 'Close mirror tab entry-1' })).toBeNull()
  expect(readAgentHubMirrors().windows).toHaveLength(1)
})
it('disables the add affordance at ten entries and refuses another addition', () => {
  const id = stage(10)
  expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true)
  expect(addAgentHubMirrorTab(id, target('eleven'))).toEqual({ status: 'tab-cap' })
  expect(screen.getAllByRole('tab')).toHaveLength(10)
})

it('returns a keyboard-closed tab home and keeps focus on its surviving neighbour', async () => {
  stage()
  const user = userEvent.setup()
  const active = screen.getByRole('tab', { name: 'entry-2, idle' })
  active.focus()
  await user.keyboard('{Shift>}{F10}{/Shift}')
  await user.keyboard('{End}{Enter}')
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  const neighbour = screen.getByRole('tab', { name: 'entry-1, idle' })
  expect(neighbour.getAttribute('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(neighbour)
  expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
})

it('shows each tab location and keeps a title editor from triggering terminal selection', () => {
  stage(2)
  const local = screen.getByRole('tab', { name: 'one, idle' })
  const remote = screen.getByRole('tab', { name: 'entry-1, idle' })
  expect(within(local).getByText('Local Mac')).toBeTruthy()
  expect(within(remote).getByText('workhost')).toBeTruthy()
  fireEvent.doubleClick(within(remote).getByText('entry-1'))
  const editor = screen.getByRole('textbox', { name: 'Rename terminal' })
  fireEvent.click(editor)
  fireEvent.keyDown(editor, { key: 'Escape' })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByTestId('focus-policy').textContent).toBe('false')
  fireEvent.keyDown(local, { key: ' ' })
  expect(local.getAttribute('aria-selected')).toBe('true')
  expect(screen.getByTestId('focus-policy').textContent).toBe('true')
})
