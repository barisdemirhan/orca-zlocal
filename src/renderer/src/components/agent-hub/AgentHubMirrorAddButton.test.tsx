/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { buildAgentStartupPlan } from '../../../../shared/agent-launch/startup/tui-agent-startup'
import type { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { TooltipProvider } from '../ui/tooltip'
import {
  makeRepo,
  makeTabWithIds,
  makeWorktree
} from '../activity/ActivityPrototypePage-test-fixtures'
import { buildAgentHubTerminalTree, type AgentHubGroupNode } from './agent-hub-terminal-tree'
import { EMPTY_AGENT_HUB_LINEAGE } from './agent-hub-lineage'
import { AgentHubMirrorAddButton } from './AgentHubMirrorAddButton'
import {
  openAgentHubMirror,
  closeAgentHubMirror,
  readAgentHubMirrors,
  resetAgentHubMirrorsForTest
} from './agent-hub-mirror-store'
import { useAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { toggleAgentHubMirrorViewing } from './agent-hub-mirror-viewing'
import { addAgentHubMirrorTab } from './agent-hub-mirror-tab-operations'
import type * as MirrorSource from './agent-hub-mirror-source'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import { paneTargetFromTerminalRow } from './agent-hub-pane-target'

const fixture = vi.hoisted(() => ({
  groups: Array<AgentHubGroupNode>(),
  disappeared: new Set<string>(),
  launch: vi.fn<typeof launchAgentInNewTab>(),
  detected: Array<TuiAgent>('claude', 'codex', 'gemini'),
  openSettingsPage: vi.fn(),
  openSettingsTarget: vi.fn()
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), message: vi.fn() } }))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: fixture.launch
}))
vi.mock('@/hooks/useAgentDetectionTarget', () => ({
  useAgentDetectionTargetForWorktree: () => ({ kind: 'local' })
}))
vi.mock('@/hooks/useDetectedAgents', () => ({
  useDetectedAgents: () => ({ detectedIds: fixture.detected })
}))
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const tabsByWorktree: Record<string, TerminalTab[]> = {}
  return {
    useAppStore: create(() => ({
      tabsByWorktree,
      terminalLayoutsByTabId: {},
      repos: [],
      worktreesByRepo: {},
      projectGroups: [],
      folderWorkspaces: [],
      deleteStateByWorktreeId: {},
      lastVisitedAtByWorktreeId: {},
      openSettingsPage: fixture.openSettingsPage,
      openSettingsTarget: fixture.openSettingsTarget,
      activeView: 'activity',
      activeWorktreeId: 'typing-workspace',
      activeTabId: 'typing-tab',
      activeTabType: 'file',
      settings: { defaultTuiAgent: 'codex', disabledTuiAgents: ['gemini'] }
    }))
  }
})
vi.mock('./use-agent-hub-terminal-tree', () => ({ useAgentHubTerminalTree: () => fixture.groups }))
vi.mock('./use-agent-hub-host-labels', () => ({ useAgentHubHostLabels: () => undefined }))
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
beforeEach(() => {
  vi.clearAllMocks()
  fixture.launch.mockReset()
  fixture.detected = ['claude', 'codex', 'gemini']
  useAppStore.setState({ tabsByWorktree: {} })
})
function setup() {
  const worktree = makeWorktree()
  const second = { ...worktree, id: 'second', displayName: 'second', branch: 'second' }
  useAppStore.setState({
    repos: [makeRepo()],
    worktreesByRepo: { [worktree.repoId]: [worktree, second] }
  })
  fixture.groups = buildAgentHubTerminalTree({
    projectGroups: [],
    repos: [],
    worktreesByRepo: { [worktree.repoId]: [worktree, second] },
    folderWorkspaces: [],
    tabsByWorktree: {
      [second.id]: [makeTabWithIds('second-terminal', second.id)],
      [worktree.id]: [
        'home',
        'other',
        'available',
        'later',
        ...Array.from({ length: 9 }, (_, i) => `extra-${i}`)
      ].map((id) => makeTabWithIds(id, worktree.id, id))
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
        <textarea aria-label="Main prompt" />
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
  return { id, onEscape, worktree, second }
}

function prepareLaunch() {
  fixture.launch.mockImplementation(({ agent, worktreeId }) => {
    const tab = makeTabWithIds('new-agent', worktreeId, agent)
    useAppStore.setState((state) => ({
      tabsByWorktree: {
        ...state.tabsByWorktree,
        [worktreeId]: [...(state.tabsByWorktree[worktreeId] ?? []), tab]
      },
      terminalLayoutsByTabId: {
        ...state.terminalLayoutsByTabId,
        [tab.id]: {
          root: { type: 'leaf', leafId: '11111111-1111-4111-8111-111111111111' },
          activeLeafId: '11111111-1111-4111-8111-111111111111',
          expandedLeafId: null
        }
      }
    }))
    const startupPlan = buildAgentStartupPlan({
      agent,
      prompt: '',
      cmdOverrides: {},
      platform: 'darwin',
      allowEmptyPromptLaunch: true
    })
    if (!startupPlan) {
      throw new Error('No startup plan')
    }
    return {
      surface: { kind: 'local-terminal', tabId: tab.id },
      startupPlan,
      pasteDraftAfterLaunch: false
    }
  })
}

function SelectionProbe() {
  const selection = useAgentHubMirrorSelection()
  return <output data-testid="mirror-focus">{String(selection.focusTerminal)}</output>
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
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
  )
})
it('clears the query on first Escape, dismisses picker on second, and never closes mirror chrome', async () => {
  const { onEscape } = setup()
  const search = await screen.findByRole('textbox', { name: 'Filter terminals' })
  fireEvent.change(search, { target: { value: 'missing' } })
  fireEvent.keyDown(search, { key: 'Escape' })
  expect(search instanceof HTMLInputElement ? search.value : null).toBe('')
  expect(screen.getByRole('textbox', { name: 'Filter terminals' })).toBeTruthy()
  fireEvent.keyDown(search, { key: 'Escape' })
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
  )
  expect(onEscape).not.toHaveBeenCalled()
})
it('rejects a source disappearing after the picker opened', async () => {
  const { id } = setup()
  const search = await screen.findByRole('textbox', { name: 'Filter terminals' })
  fireEvent.change(search, { target: { value: 'available' } })
  fixture.disappeared.add('available')
  fireEvent.keyDown(search, { key: 'ArrowDown' })
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(readAgentHubMirrors().windows.find((window) => window.id === id)?.tabs).toHaveLength(1)
  expect(screen.getByRole('textbox', { name: 'Filter terminals' })).toBeTruthy()
})
it('removes a newly reserved selection under live churn rather than adding a duplicate', async () => {
  const { id } = setup()
  const search = await screen.findByRole('textbox', { name: 'Filter terminals' })
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
  const agents = screen.getByRole('tab', { name: /^Agents/ })
  agents.focus()
  await user.keyboard('{ArrowRight}')
  const all = screen.getByRole('tab', { name: /^All terminals/ })
  expect(document.activeElement).toBe(all)
  expect(all.getAttribute('aria-selected')).toBe('true')
  expect(agents.tabIndex).toBe(-1)
  const panelId = all.getAttribute('aria-controls')
  expect(panelId && document.getElementById(panelId)?.getAttribute('role')).toBe('tabpanel')
  const search = screen.getByRole('textbox', { name: 'Filter terminals' })
  search.focus()
  fireEvent.change(search, { target: { value: 'available' } })
  await user.keyboard('{ArrowDown}')
  const selectedId = search.getAttribute('aria-activedescendant')
  expect(selectedId && document.getElementById(selectedId)?.getAttribute('aria-selected')).toBe(
    'true'
  )
  await user.keyboard('{Enter}')
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
  )
})

// AgentCombobox's trigger has no accessible name of its own; find it by its root marker.
function agentTrigger(label: string): HTMLElement {
  const trigger = document.querySelector<HTMLElement>(
    'button[role="combobox"][data-agent-combobox-root="true"]'
  )
  if (!trigger) {
    throw new Error('agent combobox trigger not found')
  }
  expect(trigger.textContent).toContain(label)
  return trigger
}

async function openNewAgent(workspace?: string) {
  const user = userEvent.setup()
  if (!screen.queryByRole('button', { name: 'New agent' })) {
    await user.click(screen.getByRole('button', { name: 'Add terminal to this mirror' }))
  }
  await user.click(
    screen.getByRole('button', {
      name: workspace ? `Add agent in ${workspace}` : 'New agent'
    })
  )
  if (workspace) {
    return screen.findByRole('menuitem', { name: /^Claude/ })
  }
  await user.click(await waitFor(() => agentTrigger('Codex')))
  await user.click(await screen.findByRole('option', { name: 'Claude' }))
  return screen.findByRole('button', { name: /Start agent/ })
}

it('opens New agent outside the picker and restores the mirror add button on Escape', async () => {
  const { onEscape } = setup()
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'New agent' })
  expect(trigger.parentElement?.contains(screen.getByRole('tab', { name: /^Agents/ }))).toBe(true)
  trigger.focus()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: 'New agent' })
  expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
  agentTrigger('Codex')
  expect(dialog.querySelector('[data-project-combobox-root]')?.textContent).toContain('Repo')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(onEscape).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Add terminal to this mirror' })
  )
  await openNewAgent()
  expect(screen.queryByRole('option', { name: /Gemini/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Open agent settings' }))
  expect(fixture.openSettingsTarget).toHaveBeenCalledWith({ pane: 'agents', repoId: null })
  expect(fixture.openSettingsPage).toHaveBeenCalledOnce()
})

it.each([{ detected: [] }, { detected: ['gemini'] }] as const)(
  'keeps settings available with no available agent in $detected',
  async ({ detected }) => {
    fixture.detected = [...detected]
    setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'New agent' }))
    await waitFor(() => agentTrigger('No available agents'))
    expect(screen.getByRole('button', { name: /Start agent/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Open agent settings' })).toBeTruthy()
  }
)

it('launches in the active home workspace and adds and selects the returned pane without navigation', async () => {
  const { id, worktree } = setup()
  prepareLaunch()
  render(<SelectionProbe />)
  const before = {
    worktree: useAppStore.getState().activeWorktreeId,
    tab: useAppStore.getState().activeTabId,
    type: useAppStore.getState().activeTabType,
    view: useAppStore.getState().activeView
  }
  fireEvent.click(await openNewAgent())
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
  )
  expect(fixture.launch).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
      worktreeId: worktree.id,
      launchSource: 'tab_bar_quick_launch',
      activate: false
    })
  )
  const mirror = readAgentHubMirrors().windows.find((window) => window.id === id)
  expect(mirror?.tabs).toHaveLength(2)
  expect(mirror?.tabs.find((tab) => tab.id === mirror.activeTabId)?.target).toMatchObject({
    worktree: { id: worktree.id },
    tab: { id: 'new-agent' },
    paneKey: 'new-agent:11111111-1111-4111-8111-111111111111'
  })
  expect(screen.getByTestId('mirror-focus').textContent).toBe('false')
  expect({
    worktree: useAppStore.getState().activeWorktreeId,
    tab: useAppStore.getState().activeTabId,
    type: useAppStore.getState().activeTabType,
    view: useAppStore.getState().activeView
  }).toEqual(before)
})

it('uses the home workspace while a family member from another workspace is displayed', async () => {
  const { id, worktree } = setup()
  const mirror = readAgentHubMirrors().windows.find((window) => window.id === id)
  const row = fixture.groups[0]?.workspaces[1]?.rows[0]
  if (!mirror?.tabs[0] || !row) {
    throw new Error('No viewing fixture')
  }
  const tabId = mirror.tabs[0].id
  act(() => toggleAgentHubMirrorViewing(id, tabId, paneTargetFromTerminalRow(row)))
  prepareLaunch()
  fireEvent.click(await openNewAgent())
  await waitFor(() => expect(fixture.launch).toHaveBeenCalledOnce())
  expect(fixture.launch.mock.calls[0]?.[0].worktreeId).toBe(worktree.id)
})

it('opens the workspace header choices and launches in that workspace', async () => {
  const { id, second } = setup()
  prepareLaunch()
  await openNewAgent('second')
  expect(screen.queryByRole('menuitem', { name: /Project/ })).toBeNull()
  expect(screen.queryByRole('menuitem', { name: /Workspace/ })).toBeNull()
  fireEvent.click(screen.getByRole('menuitem', { name: /^Codex/ }))
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
  )
  expect(fixture.launch.mock.calls[0]?.[0].worktreeId).toBe(second.id)
  const mirror = readAgentHubMirrors().windows.find((window) => window.id === id)
  expect(mirror?.tabs.find((tab) => tab.id === mirror.activeTabId)?.target.worktree.id).toBe(
    second.id
  )
})

it('refuses to start anything when the mirror fills after the picker opened', async () => {
  const { id } = setup()
  const extra =
    fixture.groups[0]?.workspaces[0]?.rows.filter((row) => row.tab.id.startsWith('extra-')) ?? []
  // Keep the picker open with its stale count while another source fills the window.
  act(() => extra.forEach((row) => addAgentHubMirrorTab(id, paneTargetFromTerminalRow(row), false)))
  fireEvent.click(await openNewAgent())
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('A mirror can hold up to 10 terminals.')
  )
  expect(fixture.launch).not.toHaveBeenCalled()
  expect(readAgentHubMirrors().windows.find((window) => window.id === id)?.tabs).toHaveLength(10)
})

it.each(['reject', 'no-result'] as const)(
  'reports a %s dialog launch failure and reopens the dialog with the same choices',
  async (failure) => {
    setup()
    const before = readAgentHubMirrors()
    if (failure === 'reject') {
      fixture.launch.mockImplementation(() => {
        throw new Error('SSH connection lost')
      })
    } else {
      fixture.launch.mockReturnValue(null)
    }
    fireEvent.click(await openNewAgent())
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not start Claude.', {
        description:
          failure === 'reject' ? 'SSH connection lost' : 'The new terminal is not available.'
      })
    )
    expect(readAgentHubMirrors()).toEqual(before)
    await screen.findByRole('dialog', { name: 'New agent' })
    agentTrigger('Claude')
    expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
    await userEvent.setup().keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Add terminal to this mirror' })
      )
    )
  }
)

it('keeps the picker open after a failed launch from a workspace row', async () => {
  setup()
  fixture.launch.mockReturnValue(null)
  fireEvent.click(await openNewAgent('second'))
  await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())
  expect(screen.getByRole('textbox', { name: 'Filter terminals' })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: 'New agent' })).toBeNull()
})

it.each(['closed-mirror', 'full-mirror', 'missing-tab'] as const)(
  'reports the launched workspace instead of a launch failure after %s',
  async (failure) => {
    const { id, worktree } = setup()
    prepareLaunch()
    const launch = fixture.launch.getMockImplementation()
    if (!launch) {
      throw new Error('No launch implementation')
    }
    fixture.launch.mockImplementation((args) => {
      const launched = launch(args)
      if (failure === 'closed-mirror') {
        closeAgentHubMirror(id)
      } else if (failure === 'full-mirror') {
        const rows = fixture.groups[0]?.workspaces[0]?.rows ?? []
        rows
          .filter((row) => row.tab.id.startsWith('extra-'))
          .forEach((row) => {
            addAgentHubMirrorTab(id, paneTargetFromTerminalRow(row), false)
          })
      } else {
        useAppStore.setState({ tabsByWorktree: {} })
      }
      return launched
    })
    fireEvent.click(await openNewAgent())
    await waitFor(() =>
      expect(toast.message).toHaveBeenCalledWith(
        `Claude started in ${worktree.displayName || worktree.branch}.`,
        { description: 'It could not be added to this mirror. Open it from the workspace tabs.' }
      )
    )
    expect(fixture.launch).toHaveBeenCalledOnce()
    expect(toast.error).not.toHaveBeenCalled()
      await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Filter terminals' })).toBeNull()
    )
  }
)

function setupTwoProjects(homeProjectTabs: string[]) {
  const home = makeWorktree()
  const billing = { ...makeWorktree(), id: 'wt-billing', repoId: 'repo-billing' }
  const repos = [makeRepo(), { ...makeRepo(), id: 'repo-billing', displayName: 'Billing' }]
  const worktreesByRepo = { [home.repoId]: [home], [billing.repoId]: [billing] }
  useAppStore.setState({ repos, worktreesByRepo })
  fixture.groups = buildAgentHubTerminalTree({
    projectGroups: [],
    repos,
    worktreesByRepo,
    folderWorkspaces: [],
    tabsByWorktree: {
      [home.id]: homeProjectTabs.map((id) => makeTabWithIds(id, home.id, id)),
      [billing.id]: [makeTabWithIds('billing-agent', billing.id)]
    },
    threads: [],
    floating: null,
    includeShells: true,
    idleAgentOf: () => 'claude',
    ungroupedLabel: 'Ungrouped',
    unknownProjectLabel: 'Project'
  })
  const homeRow = fixture.groups
    .flatMap((group) => group.workspaces.flatMap((workspace) => workspace.rows))
    .find((row) => row.tab.id === 'home')
  if (!homeRow) {
    throw new Error('No fixture')
  }
  openAgentHubMirror(paneTargetFromTerminalRow(homeRow))
  const id = readAgentHubMirrors().windows[0]?.id
  if (!id) {
    throw new Error('No window')
  }
  render(
    <TooltipProvider>
      <AgentHubMirrorAddButton
        windowId={id}
        count={1}
        threads={[]}
        lineage={EMPTY_AGENT_HUB_LINEAGE}
      />
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add terminal to this mirror' }))
}

it('starts filtered to the mirror window projects and counts what the filter hides', async () => {
  setupTwoProjects(['home', 'solo'])
  expect(await screen.findByRole('option', { name: /solo/ })).toBeTruthy()
  expect(screen.queryByRole('option', { name: /billing-agent/ })).toBeNull()
  expect(screen.getByText('1 more outside the filter')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
  expect(screen.getByRole('option', { name: /billing-agent/ })).toBeTruthy()
  expect(screen.queryByText('1 more outside the filter')).toBeNull()
})

it('keeps the filter on with a way out when the mirror projects have nothing left to add', async () => {
  setupTwoProjects(['home'])
  expect(await screen.findByText('Nothing else to add in these projects')).toBeTruthy()
  expect(screen.queryByRole('option', { name: /billing-agent/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show all projects' }))
  expect(screen.getByRole('option', { name: /billing-agent/ })).toBeTruthy()
})
