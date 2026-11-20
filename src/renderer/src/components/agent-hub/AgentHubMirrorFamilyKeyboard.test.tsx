import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui/tooltip'
import {
  PANE_KEY,
  PANE_KEY_2,
  PANE_KEY_3,
  makeTabWithIds,
  makeWorktree
} from './agent-hub-activity-test-fixtures'
import { activeAgentHubMirrorTab, shownAgentHubMirrorTarget } from './agent-hub-mirror-membership'
import { selectAgentHubMirrorFamilyMember } from './agent-hub-mirror-tab-actions'
import { returnAgentHubMirrorTabHome } from './agent-hub-mirror-viewing'
import { agentHubMirrorFamilyActions } from './agent-hub-mirror-family-actions'
import { paneTargetFromThread, type AgentHubPaneTarget } from './agent-hub-pane-target'
import type * as MirrorSource from './agent-hub-mirror-source'
import { AgentHubMirrorTabStrip } from './AgentHubMirrorTabStrip'
import { HubRowMirrorActions } from './AgentHubRowActions'
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

function Stage({ source = threads }: { source?: typeof threads }): React.JSX.Element {
  const { windows } = useAgentHubMirrors()
  const family = agentHubMirrorFamily(PANE_KEY, source, buildAgentHubLineage(source, 1_000))
  return (
    <TooltipProvider>
      {windows.map((window) => (
        <div key={window.id} data-agent-hub-mirror>
          <AgentHubMirrorTabStrip
            window={window}
            threads={source}
            lineage={buildAgentHubLineage(source, 1_000)}
            locationOf={() => location}
            onReveal={vi.fn()}
          />
          {family ? (
            <AgentHubMirrorFamilyTabs
              family={family}
              activeKey={
                shownAgentHubMirrorTarget(activeAgentHubMirrorTab(window)).paneKey ?? PANE_KEY
              }
              home={
                activeAgentHubMirrorTab(window).viewing
                  ? {
                      title: 'Dispatcher',
                      onSelect: () => returnAgentHubMirrorTabHome(window.id, window.activeTabId)
                    }
                  : undefined
              }
              locationOf={() => location}
              actionsFor={(member) =>
                agentHubMirrorFamilyActions({
                  member,
                  state: readAgentHubMirrors(),
                  windowId: window.id,
                  onScreenTab: null,
                  onReveal: vi.fn()
                })
              }
              onSelect={(member) =>
                selectAgentHubMirrorFamilyMember(
                  window.id,
                  window.activeTabId,
                  paneTargetFromThread(member, member.tab.id)
                )
              }
            />
          ) : null}
        </div>
      ))}
    </TooltipProvider>
  )
}

function stage(source = threads): HTMLElement {
  openAgentHubMirror(dispatcherTarget())
  render(<Stage source={source} />)
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
  await user.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(rows[1])
  await user.keyboard('{ArrowLeft}{ArrowUp}')
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
    <TooltipProvider>
      <AgentHubMirrorFamilyTabs
        family={family}
        activeKey={PANE_KEY}
        locationOf={() => location}
        actionsFor={() => ({})}
        onSelect={onSelect}
      />
    </TooltipProvider>
  )
  screen.getAllByRole('treeitem')[0]?.focus()
  await user.keyboard('{ArrowRight}{Enter}')
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

it('clicking a viewed worker again or its home row returns without changing the tab', async () => {
  const tab = stage()
  const beforeLabel = tab.getAttribute('aria-label')
  const worker = screen.getAllByRole('treeitem')[0]
  fireEvent.click(worker)
  expect(screen.getByRole('tab')).toBe(tab)
  expect(tab.getAttribute('aria-label')).toBe(beforeLabel)
  expect(worker.getAttribute('aria-selected')).toBe('true')
  expect(screen.getByRole('treeitem', { name: 'Dispatcher' })).toBeTruthy()
  const user = userEvent.setup()
  await user.hover(worker)
  expect(await screen.findByText('Click again to return to Dispatcher')).toBeTruthy()
  expect(await screen.findByText('Where')).toBeTruthy()
  expect(screen.queryByRole('tooltip')).toBeNull()
  expect(worker.getAttribute('aria-description')).toBe('Click again to return to Dispatcher')
  fireEvent.click(worker)
  expect(screen.queryByRole('treeitem', { name: 'Dispatcher' })).toBeNull()
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
  fireEvent.click(worker)
  fireEvent.click(screen.getByRole('treeitem', { name: 'Dispatcher' }))
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
})
it('Enter and Space toggle the focused worker just like a click', async () => {
  stage()
  const worker = screen.getAllByRole('treeitem')[0]
  const user = userEvent.setup()
  worker.focus()
  await user.keyboard('{Enter}')
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing?.paneKey).toBe(PANE_KEY_2)
  worker.focus()
  await user.keyboard(' ')
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
})
it('shows siblings together, counts hidden children, and navigates only the viewed branch', async () => {
  const source = agentHubThreadsFor([
    { paneKey: PANE_KEY, state: 'working', at: 1_000 },
    { paneKey: PANE_KEY_2, state: 'working', at: 1_000, parentPaneKey: PANE_KEY },
    { paneKey: PANE_KEY_3, state: 'done', at: 1_000, parentPaneKey: PANE_KEY_2 }
  ])
  stage(source)
  const parent = screen.getByRole('treeitem')
  expect(parent.getAttribute('aria-expanded')).toBe('false')
  expect(within(parent).getByText('1')).toBeTruthy()
  fireEvent.click(parent)
  const groups = screen.getAllByRole('group')
  expect(groups).toHaveLength(2)
  expect(within(groups[0]).getAllByRole('treeitem')).toHaveLength(2)
  expect(within(groups[1]).getAllByRole('treeitem')).toHaveLength(1)
  expect(parent.getAttribute('aria-expanded')).toBe('true')
  const child = within(groups[1]).getByRole('treeitem')
  expect(child.getAttribute('aria-level')).toBe('2')
  const user = userEvent.setup()
  parent.focus()
  await user.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(child)
  await user.keyboard('{ArrowUp}')
  expect(document.activeElement).toBe(parent)
  fireEvent.click(child)
  expect(screen.getAllByRole('group')).toHaveLength(2)
  expect(child.getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('treeitem', { name: 'Dispatcher' }))
  expect(screen.getAllByRole('group')).toHaveLength(1)
})
it('offers opening a viewed worker as a tab and activates it from the hover card', async () => {
  stage()
  const worker = screen.getAllByRole('treeitem')[0]
  fireEvent.click(worker)
  const user = userEvent.setup()
  await user.hover(worker)
  fireEvent.click(await screen.findByRole('button', { name: 'Open as a tab here' }))
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  const window = readAgentHubMirrors().windows[0]
  expect(window?.activeTabId).toBe(window?.tabs[1]?.id)
  expect(window?.tabs[0]?.viewing).toBeUndefined()
})

it('shows a viewed member from the hub without creating a second window', () => {
  stage()
  fireEvent.click(screen.getAllByRole('treeitem')[0])
  const member = threads.find((thread) => thread.paneKey === PANE_KEY_2)
  if (!member) {
    throw new Error('No worker')
  }
  const onPopout = vi.fn()
  render(
    <TooltipProvider>
      <HubRowMirrorActions
        mirrorKey={member.paneKey}
        target={paneTargetFromThread(member, 'Worker')}
        onPopout={onPopout}
      />
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show in mirror' }))
  expect(onPopout).not.toHaveBeenCalled()
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing?.paneKey).toBe(PANE_KEY_2)
})
it('opens Own window from a viewed member and hides Open as a tab here once it has a real tab', async () => {
  stage()
  const worker = screen.getAllByRole('treeitem')[0]
  fireEvent.click(worker)
  const user = userEvent.setup()
  await user.hover(worker)
  fireEvent.click(await screen.findByRole('button', { name: 'Own window' }))
  expect(readAgentHubMirrors().windows).toHaveLength(2)
  expect(readAgentHubMirrors().windows[0]?.tabs[0]?.viewing).toBeUndefined()
  expect(readAgentHubMirrors().windows[1]?.tabs[0]?.target.paneKey).toBe(PANE_KEY_2)
  await user.unhover(worker)
  await user.hover(worker)
  expect(await screen.findByText('Where')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Open as a tab here' })).toBeNull()
})
