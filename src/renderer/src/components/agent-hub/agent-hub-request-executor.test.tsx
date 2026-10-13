/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { toRemoteRuntimePtyId } from '../../../../shared/remote-runtime-pty-id'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import {
  LEAF_ID,
  LEAF_ID_2,
  PANE_KEY,
  PANE_KEY_2,
  makeRepo
} from '../activity/ActivityPrototypePage-test-fixtures'
import type { AgentHubRequest } from '../../../../shared/agent-hub-requests'
import { agentHubRequestBase } from './agent-hub-request-test-fixtures'
import { buildAgentHubLists } from './agent-hub-lists'
import { executeAgentHubRequest } from './agent-hub-request-executor'
import { findAgentHubRequestTarget } from './agent-hub-request-target'
import {
  closeAgentHubPeek,
  readAgentHubPeek,
  registerAgentHubPeekHost
} from './agent-hub-peek-store'
import { isAgentHubCanvasOpen, resetAgentHubCanvasForTest } from './agent-hub-canvas-store'
import { readAgentHubMirrors, resetAgentHubMirrorsForTest } from './agent-hub-mirror-store'
import { useAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { useAgentHubMirrorSelectionFocus } from './use-agent-hub-mirror-selection-focus'
import { applyAgentHubDelivery, clearAgentHubRequestHost } from './agent-hub-requests-store'
import { AgentHubRow } from './AgentHubRow'
import { AgentHubMirrorTab } from './AgentHubMirrorTab'
import { AgentHubPeek } from './AgentHubPeek'
import { useRef } from 'react'
import { openWorkspaceBrowserTab } from '@/lib/workspace-browser-tab-open'

vi.mock('@/lib/workspace-browser-tab-open', () => ({
  openWorkspaceBrowserTab: vi.fn(async () => {})
}))

vi.mock('@/lib/client-creation-action-policy', () => ({
  getClientCreationActionPolicy: () => ({ 'managed-browser': { state: 'enabled' } })
}))
vi.mock('@/lib/connection-context', () => ({
  getConnectionIdForFile: () => null,
  getConnectionId: () => null
}))
vi.mock('./AgentHubPeekFile', () => ({ AgentHubPeekFile: () => <div /> }))
vi.mock('./AgentHubPeekBrowser', () => ({
  AgentHubPeekBrowser: () => <div />,
  closeLeftoverAgentHubPeekPages: () => {}
}))
const initial = useAppStore.getState()
const threads = agentHubThreadsFor([
  { paneKey: PANE_KEY, state: 'waiting', at: 1 },
  { paneKey: PANE_KEY_2, state: 'working', at: 1 }
]).map((thread) => ({ ...thread, worktree: { ...thread.worktree, hostId: 'local' as const } }))
const base = agentHubRequestBase()
const target = { ...base.target, paneKey: PANE_KEY_2, terminalHandle: 'term-2' }
const presence = vi.fn(async () => ({ present: true, idleMinutes: 0.5 }))
const context = { threads, lists: buildAgentHubLists(threads) }
const run = (request: AgentHubRequest, host = 'local') =>
  executeAgentHubRequest(host, request, context)
let releasePeek: () => void
beforeEach(() => {
  useAppStore.setState({
    settings: createGlobalSettingsFixture({ experimentalAgentHub: true }),
    repos: [makeRepo()],
    worktreesByRepo: { 'repo-1': [threads[0].worktree] },
    tabsByWorktree: { [threads[0].worktree.id]: threads.map((thread) => thread.tab) },
    terminalLayoutsByTabId: {
      'tab-1': {
        root: { type: 'leaf', leafId: LEAF_ID },
        activeLeafId: LEAF_ID,
        expandedLeafId: null,
        ptyIdsByLeafId: { [LEAF_ID]: 'term-1' }
      },
      'tab-2': {
        root: { type: 'leaf', leafId: LEAF_ID_2 },
        activeLeafId: LEAF_ID_2,
        expandedLeafId: null,
        ptyIdsByLeafId: { [LEAF_ID_2]: 'term-2' }
      }
    },
    ptyIdsByTabId: { 'tab-1': ['term-1'], 'tab-2': ['term-2'] },
    rightSidebarOpen: false
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0)
  )
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  Object.defineProperty(window, 'api', {
    value: { notifications: { getDesktopPresence: presence }, shell: { openUrl: vi.fn() } },
    configurable: true
  })
  releasePeek = registerAgentHubPeekHost()
})
afterEach(() => {
  cleanup()
  closeAgentHubPeek()
  releasePeek()
  resetAgentHubCanvasForTest()
  resetAgentHubMirrorsForTest()
  clearAgentHubRequestHost('local')
  clearAgentHubRequestHost('workhost')
  useAppStore.setState(initial)
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Agent Hub non-card actions', () => {
  it('opens, adds to the caller’s window, parks, restores and closes without selecting keyboard input', async () => {
    expect(await run({ ...base, kind: 'mirror', action: 'open' })).toEqual({ kind: 'ack' })
    const windowId = readAgentHubMirrors().windows[0]?.id
    expect(windowId).toBeTruthy()
    expect(await run({ ...base, target, kind: 'mirror', action: 'add' })).toEqual({ kind: 'ack' })
    expect(readAgentHubMirrors().windows).toHaveLength(1)
    expect(readAgentHubMirrors().windows[0]?.tabs).toHaveLength(2)
    expect(await run({ ...base, target, kind: 'mirror', action: 'minimize' })).toEqual({
      kind: 'ack'
    })
    expect(readAgentHubMirrors().chips[0]?.window.id).toBe(windowId)
    expect(await run({ ...base, target, kind: 'mirror', action: 'restore' })).toEqual({
      kind: 'ack'
    })
    function Selection(): React.JSX.Element {
      const selection = useAgentHubMirrorSelection()
      return <output>{String(selection.focusTerminal)}</output>
    }
    render(<Selection />)
    expect(screen.getByText('false')).toBeTruthy()
    expect(await run({ ...base, target, kind: 'mirror', action: 'close' })).toEqual({ kind: 'ack' })
    expect(readAgentHubMirrors().windows).toHaveLength(0)
    expect(await run({ ...base, kind: 'mirror', action: 'add' })).toEqual({ kind: 'ack' })
    expect(readAgentHubMirrors().windows).toHaveLength(1)
    await run({ ...base, kind: 'mirror', action: 'minimize' })
    await run({ ...base, kind: 'mirror', action: 'close' })
    expect(readAgentHubMirrors().chips).toHaveLength(0)
  })

  it('keeps a typing field focused when the selected terminal attaches after an agent opens it', async () => {
    const typing = document.createElement('textarea')
    document.body.append(typing)
    typing.focus()
    const found = findAgentHubRequestTarget(useAppStore.getState(), threads, 'local', base.target)
    if (!found) {
      throw new Error('Missing pane')
    }
    const pane = found
    await run({ ...base, kind: 'mirror', action: 'open' })
    const mirror = readAgentHubMirrors().windows[0]
    if (!mirror) {
      throw new Error('Missing mirror')
    }
    function Attached(): React.JSX.Element {
      const rootRef = useRef<HTMLDivElement>(null)
      useAgentHubMirrorSelectionFocus({
        windowId: mirror.id,
        tabId: mirror.activeTabId,
        target: pane,
        rootRef,
        allowed: true,
        preview: false
      })
      return (
        <div ref={rootRef}>
          <div data-terminal-tab-id="tab-1">
            <div data-leaf-id={LEAF_ID}>
              <textarea className="xterm-helper-textarea" />
            </div>
          </div>
        </div>
      )
    }
    render(<Attached />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.activeElement).toBe(typing)
    expect(await run({ ...base, kind: 'canvas', action: 'open' })).toEqual({ kind: 'ack' })
    expect(document.activeElement).toBe(typing)
    typing.remove()
  })

  it('uses the existing layout and canvas controls and rejects an unsupported layout', async () => {
    expect(await run({ ...base, kind: 'arrange' })).toEqual({ kind: 'ack' })
    for (const layout of ['grid', 'rows', 'columns']) {
      expect(await run({ ...base, kind: 'arrange', layout })).toEqual({ kind: 'ack' })
    }
    expect(await run({ ...base, kind: 'arrange', layout: 'unknown' })).toMatchObject({
      kind: 'error',
      code: 'invalid_argument'
    })
    expect(await run({ ...base, kind: 'canvas', action: 'open' })).toEqual({ kind: 'ack' })
    expect(isAgentHubCanvasOpen()).toBe(true)
    await run({ ...base, kind: 'canvas', action: 'close' })
    expect(isAgentHubCanvasOpen()).toBe(false)
  })

  it('keeps the typing field focused when Peek opens and closes', async () => {
    render(
      <TooltipProvider>
        <AgentHubPeek />
      </TooltipProvider>
    )
    const typing = document.createElement('textarea')
    document.body.append(typing)
    typing.focus()
    await act(async () => {
      expect(await run({ ...base, kind: 'peek', link: '/artifact.png' })).toEqual({ kind: 'ack' })
    })
    expect(document.activeElement).toBe(typing)
    act(closeAgentHubPeek)
    expect(document.activeElement).toBe(typing)
    typing.remove()
  })

  it('routes CLI Peek requests through the local or paired source and falls back for unforwarded loopback', async () => {
    expect(await run({ ...base, kind: 'peek', link: 'http://localhost:3000' })).toEqual({
      kind: 'ack'
    })
    expect(readAgentHubPeek()?.history.at(-1)?.content).toEqual({
      kind: 'web',
      url: 'http://localhost:3000',
      hostId: 'local'
    })
    expect(readAgentHubPeek()?.history.at(-1)?.preserveKeyboardFocus).toBe(true)
    expect(await run({ ...base, kind: 'peek', link: 'image.png' })).toEqual({ kind: 'ack' })
    expect(readAgentHubPeek()?.history.at(-1)?.content).toMatchObject({
      kind: 'image',
      filePath: '/repo/wt-1/image.png',
      connectionId: null
    })
    const remote = {
      ...threads[0],
      worktree: {
        ...threads[0].worktree,
        hostId: 'runtime:workhost' as const,
        runtimeOwnerEnvironmentId: 'workhost'
      }
    }
    const result = await executeAgentHubRequest(
      'workhost',
      { ...base, kind: 'peek', link: 'http://localhost:3000' },
      { threads: [remote], lists: buildAgentHubLists([remote]) }
    )
    expect(result).toEqual({ kind: 'ack' })
    expect(openWorkspaceBrowserTab).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRuntimeEnvironmentId: 'workhost', url: 'http://localhost:3000' })
    )
    expect(readAgentHubPeek()?.history).toHaveLength(2)
    const pairedContext = { threads: [remote], lists: buildAgentHubLists([remote]) }
    expect(
      await executeAgentHubRequest(
        'workhost',
        { ...base, kind: 'peek', link: 'https://site.dev.test' },
        pairedContext
      )
    ).toEqual({ kind: 'ack' })
    expect(readAgentHubPeek()?.history.at(-1)).toMatchObject({
      content: { hostId: 'local', url: 'https://site.dev.test' },
      preserveKeyboardFocus: true
    })
    expect(
      await executeAgentHubRequest(
        'workhost',
        { ...base, kind: 'peek', link: 'image.png' },
        pairedContext
      )
    ).toEqual({ kind: 'ack' })
    expect(readAgentHubPeek()?.history.at(-1)?.content).toMatchObject({
      kind: 'image',
      filePath: '/repo/wt-1/image.png',
      readContext: {
        worktreeId: remote.worktree.id,
        relativePath: 'image.png',
        target: { kind: 'environment', environmentId: 'workhost' }
      }
    })
    vi.mocked(openWorkspaceBrowserTab).mockRejectedValueOnce(new Error('Host disconnected'))
    expect(
      await executeAgentHubRequest(
        'workhost',
        { ...base, kind: 'peek', link: 'http://localhost:3000' },
        pairedContext
      )
    ).toMatchObject({ kind: 'error', message: 'Host disconnected' })
    expect(await run({ ...base, kind: 'peek', link: 'notes.md' })).toEqual({ kind: 'ack' })
    expect(readAgentHubPeek()?.history.at(-1)).toMatchObject({
      content: { kind: 'markdown', filePath: '/repo/wt-1/notes.md' },
      preserveKeyboardFocus: true
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => 0)
    expect(await run({ ...base, kind: 'peek', link: 'notes.txt' })).toEqual({
      kind: 'error',
      code: 'invalid_argument',
      message:
        'Peek opens web pages, images, PDF, audio, video, HTML and Markdown files. This file type is not supported.'
    })
    expect(toastError).toHaveBeenCalledWith(
      'Peek opens web pages, images, PDF, audio, video, HTML and Markdown files. This file type is not supported.'
    )
    toastError.mockRestore()
  })

  it('reports host-scoped mirrors, parked panes, CLI questions and desktop presence only', async () => {
    await run({ ...base, kind: 'mirror', action: 'open' })
    await run({ ...base, target, kind: 'mirror', action: 'open' })
    await run({ ...base, target, kind: 'mirror', action: 'minimize' })
    applyAgentHubDelivery('local', {
      ...base,
      target,
      kind: 'ask',
      question: 'Go?',
      options: ['Yes'],
      multi: false
    })
    expect(await run({ ...base, kind: 'status' })).toEqual({
      kind: 'status',
      mirrors: [base.target],
      parked: [target],
      waiting: [base.target, target]
    })
    expect(await run({ ...base, kind: 'status' }, 'workhost')).toEqual({
      kind: 'status',
      mirrors: [],
      parked: [],
      waiting: []
    })
    expect(await run({ ...base, kind: 'presence' })).toEqual({
      kind: 'presence',
      present: true,
      idleMinutes: 0.5
    })
  })

  it('resolves equal pane keys by host and unwraps paired terminal handles', () => {
    const remote = {
      ...threads[0],
      worktree: {
        ...threads[0].worktree,
        hostId: 'runtime:workhost' as const,
        runtimeOwnerEnvironmentId: 'workhost'
      }
    }
    expect(
      findAgentHubRequestTarget(useAppStore.getState(), [...threads, remote], 'workhost', base.target)
        ?.worktree
    ).toBe(remote.worktree)
    expect(
      findAgentHubRequestTarget(
        useAppStore.getState(),
        [...threads, remote],
        'missing',
        base.target
      )
    ).toBeNull()
    useAppStore.setState({
      ptyIdsByTabId: { 'tab-1': [toRemoteRuntimePtyId('term-1', 'workhost')] },
      terminalLayoutsByTabId: {
        'tab-1': {
          root: { type: 'leaf', leafId: LEAF_ID },
          activeLeafId: LEAF_ID,
          expandedLeafId: null,
          ptyIdsByLeafId: { [LEAF_ID]: toRemoteRuntimePtyId('term-1', 'workhost') }
        }
      }
    })
    expect(
      findAgentHubRequestTarget(useAppStore.getState(), [remote], 'workhost', {
        paneKey: 'old',
        terminalHandle: 'term-1'
      })?.paneKey
    ).toBe(PANE_KEY)
  })

  it('renders host-scoped progress in the existing row and mirror header copy', () => {
    const pane = findAgentHubRequestTarget(useAppStore.getState(), threads, 'local', base.target)
    if (!pane) {
      throw new Error('Missing pane')
    }
    applyAgentHubDelivery('local', { ...base, kind: 'progress', text: 'Building now' })
    render(
      <TooltipProvider>
        <AgentHubRow
          kind="work"
          agentType="codex"
          title="Agent"
          selected={false}
          mirrorKey={PANE_KEY}
          mirrorTarget={pane}
          onOpen={() => {}}
          onPopout={() => {}}
          onJump={() => {}}
        />
      </TooltipProvider>
    )
    expect(screen.getByText('Building now')).toBeTruthy()
    render(
      <TooltipProvider>
        <AgentHubMirrorTab
          windowId="w"
          tab={{ id: 't', target: pane, origin: 'manual' }}
          active
          thread={null}
          location={{ group: null, project: 'Repo', workspace: null }}
          familyRoot={null}
          closable={false}
          inputOwner={false}
          panelId="panel"
          onSelect={() => {}}
          onReveal={() => {}}
          onClose={() => {}}
        />
      </TooltipProvider>
    )
    expect(screen.getAllByText('Building now')).toHaveLength(2)
    act(() => applyAgentHubDelivery('workhost', { ...base, kind: 'progress', text: 'Remote progress' }))
    expect(screen.queryByText('Remote progress')).toBeNull()
    act(() => applyAgentHubDelivery('local', { ...base, kind: 'progress', text: null }))
    expect(screen.queryByText('Building now')).toBeNull()
  })
})

it('adds a newly reported spawned child to the already open caller mirror', async () => {
  const beforeSpawn = useAppStore.getState()
  useAppStore.setState({
    tabsByWorktree: { [threads[0].worktree.id]: [threads[0].tab] },
    terminalLayoutsByTabId: { 'tab-1': beforeSpawn.terminalLayoutsByTabId['tab-1'] }
  })
  const initialContext = { threads: [threads[0]], lists: buildAgentHubLists([threads[0]]) }
  await executeAgentHubRequest('local', { ...base, kind: 'mirror', action: 'open' }, initialContext)
  const windowId = readAgentHubMirrors().windows[0]?.id
  const childEntry = threads[1].currentAgentEntry
  if (!childEntry) {
    throw new Error('Missing child status')
  }
  const child = {
    ...threads[1],
    currentAgentEntry: { ...childEntry, spawnedBy: { paneKey: PANE_KEY } },
    paneEntry: { ...childEntry, spawnedBy: { paneKey: PANE_KEY } }
  }
  useAppStore.setState({
    tabsByWorktree: beforeSpawn.tabsByWorktree,
    terminalLayoutsByTabId: beforeSpawn.terminalLayoutsByTabId
  })
  const freshContext = {
    threads: [threads[0], child],
    lists: buildAgentHubLists([threads[0], child])
  }
  expect(
    await executeAgentHubRequest(
      'local',
      { ...base, target, kind: 'mirror', action: 'add' },
      freshContext
    )
  ).toEqual({ kind: 'ack' })
  expect(readAgentHubMirrors().windows).toHaveLength(1)
  expect(readAgentHubMirrors().windows[0]?.id).toBe(windowId)
  expect(readAgentHubMirrors().windows[0]?.tabs.map((tab) => tab.target.paneKey)).toEqual([
    PANE_KEY,
    PANE_KEY_2
  ])
})
