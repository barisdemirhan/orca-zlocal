/** @vitest-environment happy-dom */
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { AgentDetectionTarget } from '@/lib/agent-session/launch/inventory/useDetectedAgents'
import type { Worktree } from '../../../../shared/worktree/types'
import { folderWorkspaceToWorktree } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { TooltipProvider } from '../ui/tooltip'
import { makeRepo, makeWorktree } from './agent-hub-activity-test-fixtures'
import { AgentHubMirrorNewAgent } from './AgentHubMirrorNewAgent'
import { AgentHubNewAgentDialog } from './AgentHubNewAgentDialog'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({
      repos: [],
      worktreesByRepo: {},
      projectGroups: [],
      folderWorkspaces: [],
      deleteStateByWorktreeId: {},
      lastVisitedAtByWorktreeId: {},
      runtimeEnvironments: [{ id: 'server', name: 'Build server' }],
      sshTargetLabels: new Map(),
      removedSshTargetLabels: new Map(),
      settings: { defaultTuiAgent: 'claude', disabledTuiAgents: [] },
      openSettingsPage: vi.fn(),
      openSettingsTarget: vi.fn()
    }))
  }
})
vi.mock('@/lib/agent-session/launch/inventory/useAgentDetectionTarget', () => ({
  useAgentDetectionTargetForWorktree: (id: string | null) =>
    id?.startsWith('remote') ? { kind: 'runtime', environmentId: 'server' } : { kind: 'local' }
}))
vi.mock('@/lib/agent-session/launch/inventory/useDetectedAgents', () => ({
  useDetectedAgents: (target: AgentDetectionTarget | undefined) => ({
    detectedIds:
      target === undefined ? null : target.kind === 'runtime' ? ['codex', 'gemini'] : ['claude']
  })
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({
    projectGroups: [],
    folderWorkspaces: [],
    deleteStateByWorktreeId: {},
    lastVisitedAtByWorktreeId: {},
    settings: { ...getDefaultSettings('/test'), defaultTuiAgent: 'claude', disabledTuiAgents: [] }
  })
})

function setup() {
  const home = makeWorktree()
  const remoteRepo = { ...makeRepo(), id: 'remote-project', path: '/remote', displayName: 'Remote' }
  const remote = {
    ...home,
    id: 'remote-build',
    repoId: remoteRepo.id,
    hostId: 'runtime:server' as const,
    runtimeOwnerEnvironmentId: 'server',
    displayName: 'Build',
    branch: 'feature/build',
    lastActivityAt: 20
  }
  const review = {
    ...remote,
    id: 'remote-review',
    displayName: 'Review',
    branch: 'feature/review',
    lastActivityAt: 10
  }
  useAppStore.setState({
    repos: [makeRepo(), remoteRepo],
    worktreesByRepo: { [home.repoId]: [home], [remoteRepo.id]: [remote, review] }
  })
  const onStart = vi.fn()
  const onEscape = vi.fn()
  function Mirror() {
    const [dialogHome, setDialogHome] = useState<Worktree | null>(null)
    return (
      <TooltipProvider>
        <div data-testid="mirror" onKeyDown={(event) => event.key === 'Escape' && onEscape()}>
          <AgentHubMirrorNewAgent
            worktree={home}
            pending={false}
            onStart={onStart}
            onOpenDialog={setDialogHome}
          />
          {dialogHome ? (
            <AgentHubNewAgentDialog
              worktree={dialogHome}
              pending={false}
              onStart={onStart}
              onClose={() => setDialogHome(null)}
            />
          ) : null}
        </div>
      </TooltipProvider>
    )
  }
  render(<Mirror />)
  return { home, remote, review, onStart, onEscape }
}

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

async function openDialog() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'New agent' }))
  return screen.findByRole('dialog', { name: 'New agent' })
}

async function chooseProject(name: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Project' }))
  await user.keyboard(name)
  // Match highlighting splits the label into per-letter marks, so match by text.
  await waitFor(() =>
    expect(screen.getAllByRole('option').some((row) => row.textContent?.includes(name))).toBe(true)
  )
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
}

it('opens a dialog with home selections and submits Enter from the agent field', async () => {
  const { home, onStart } = setup()
  const dialog = await openDialog()
  expect(within(dialog).getByRole('heading', { name: 'New agent' })).toBeTruthy()
  expect(within(dialog).getByRole('combobox', { name: 'Workspace' }).textContent).toContain(
    home.displayName
  )
  expect(dialog.querySelector('[data-project-combobox-root]')?.textContent).toContain('Repo')
  expect(screen.queryByRole('button', { name: 'Add project' })).toBeNull()
  const agent = agentTrigger('Claude')
  await waitFor(() => expect(document.activeElement).toBe(agent))
  await userEvent.setup().keyboard('{Enter}')
  expect(onStart).toHaveBeenCalledExactlyOnceWith(home, 'claude')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it.each([
  ['MacIntel', { metaKey: true }, '⌘'],
  ['Windows', { ctrlKey: true }, 'Ctrl']
] as const)(
  'chooses a remote workspace and its agent by keyboard and submits on %s',
  async (platform, modifier, hint) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(platform)
    const { remote, review, onStart } = setup()
    useAppStore.setState({ lastVisitedAtByWorktreeId: { [review.id]: 50 } })
    const dialog = await openDialog()
    await chooseProject('Remote')
    const workspace = screen.getByRole('combobox', { name: 'Workspace' })
    expect(workspace.textContent).toContain('Review')
    expect(workspace.textContent).toContain('feature/review')
    expect(workspace.textContent).toContain('Build server')
    const user = userEvent.setup()
    workspace.focus()
    await user.keyboard('{Enter}')
    const search = await screen.findByPlaceholderText('Search workspaces')
    await user.type(search, 'Build')
    expect(
      await screen.findByRole('option', { name: /Build.*feature\/build.*Build server/ })
    ).toBeTruthy()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('option')).toBeNull())
    const agent = agentTrigger('Codex')
    await user.click(agent)
    expect(await screen.findByRole('option', { name: 'Gemini' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Claude' })).toBeNull()
    await user.type(screen.getByPlaceholderText('Search agents...'), 'Gemini')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('option')).toBeNull())
    expect(screen.getByRole('button', { name: /Start agent/ }).textContent).toContain(hint)
    fireEvent.keyDown(dialog, { key: 'Enter', ...modifier })
    expect(onStart).toHaveBeenCalledExactlyOnceWith(remote, 'gemini')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
)

it('falls back when a chosen agent is unavailable on the next workspace host', async () => {
  const { home, onStart } = setup()
  await openDialog()
  await chooseProject('Remote')
  await userEvent.setup().click(agentTrigger('Codex'))
  fireEvent.click(await screen.findByRole('option', { name: 'Gemini' }))
  await chooseProject('Repo')
  expect(agentTrigger('Claude')).toBeTruthy()
  await userEvent.setup().click(screen.getByRole('button', { name: /Start agent/ }))
  expect(onStart).toHaveBeenCalledExactlyOnceWith(home, 'claude')
})

it.each(['Escape', 'Close'])(
  'closes only the dialog with %s and restores home on reopening',
  async (method) => {
    const { home, onEscape, onStart } = setup()
    await openDialog()
    await chooseProject('Remote')
    if (method === 'Escape') {
      agentTrigger('Codex').focus()
      await userEvent.setup().keyboard('{Escape}')
    } else {
      await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onEscape).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
    expect(screen.getByTestId('mirror')).toBeTruthy()
    await openDialog()
    expect(screen.getByRole('combobox', { name: 'Workspace' }).textContent).toContain(
      home.displayName
    )
    expect(agentTrigger('Claude')).toBeTruthy()
  }
)

it('blocks a removed selection and recovers by selecting an existing project', async () => {
  const { home, remote, review, onStart } = setup()
  const dialog = await openDialog()
  act(() => useAppStore.setState({ worktreesByRepo: { [remote.repoId]: [remote, review] } }))
  const start = screen.getByRole('button', { name: /Start agent/ })
  expect(start.hasAttribute('disabled')).toBe(true)
  fireEvent.click(start)
  fireEvent.keyDown(dialog, { key: 'Enter', ctrlKey: true, metaKey: false })
  expect(onStart).not.toHaveBeenCalled()
  await chooseProject('Remote')
  await userEvent.setup().click(screen.getByRole('button', { name: /Start agent/ }))
  expect(onStart).toHaveBeenCalledExactlyOnceWith(remote, 'codex')
  expect(onStart).not.toHaveBeenCalledWith(home, expect.anything())
})

it('shows and launches a folder workspace without inventing a branch', async () => {
  const { onStart } = setup()
  const group: ProjectGroup = {
    id: 'notes',
    name: 'Notes',
    parentPath: '/notes',
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 0,
    updatedAt: 0
  }
  const folder: FolderWorkspace = {
    id: 'drafts',
    projectGroupId: group.id,
    name: 'Drafts',
    folderPath: '/notes/drafts',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
  act(() => useAppStore.setState({ projectGroups: [group], folderWorkspaces: [folder] }))
  await openDialog()
  await chooseProject('Notes')
  await userEvent.setup().click(screen.getByRole('combobox', { name: 'Workspace' }))
  const row = await screen.findByRole('option', { name: 'Drafts' })
  expect(row.textContent).toBe('Drafts')
  await userEvent.setup().keyboard('{Escape}')
  await userEvent.setup().click(screen.getByRole('button', { name: /Start agent/ }))
  expect(onStart).toHaveBeenCalledExactlyOnceWith(folderWorkspaceToWorktree(folder), 'claude')
})

it('keeps an empty host disabled and provides agent settings', async () => {
  setup()
  useAppStore.setState({
    settings: {
      ...getDefaultSettings('/test'),
      defaultTuiAgent: 'claude',
      disabledTuiAgents: ['claude']
    }
  })
  await openDialog()
  expect(screen.getByRole('button', { name: /Start agent/ }).hasAttribute('disabled')).toBe(true)
  expect(agentTrigger('No available agents')).toBeTruthy()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Open agent settings' }))
  expect(useAppStore.getState().openSettingsTarget).toHaveBeenCalledWith({
    pane: 'agents',
    repoId: null
  })
  expect(useAppStore.getState().openSettingsPage).toHaveBeenCalledOnce()
})
