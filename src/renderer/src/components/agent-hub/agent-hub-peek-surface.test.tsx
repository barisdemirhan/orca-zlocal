/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { markHydratedBrowserPageHandles } from '@/store/slices/browser/hosts/browser-initialization-presentation-ownership'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { AGENT_HUB_PEEK_WORKTREE_ID } from '../../../../shared/agent-hub-peek-workspace'
import { makeFolderWorkspace } from '@/store/folder-workspaces/folder-workspace.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { TEST_REPO } from '@/store/repos/repo.test-fixture'
import { readRuntimeFileContent } from '@/runtime/files/reads/runtime-file-read-client'
import type * as RuntimeFileClient from '@/runtime/files/reads/runtime-file-read-client'
import type * as HttpLinkRouting from '@/lib/browser/navigation/http-link-routing'
import { agentHubPeekFileItem } from './agent-hub-peek-routing'
import { AgentHubPeekBrowser } from './AgentHubPeekBrowser'
import { AgentHubPeekFile } from './AgentHubPeekFile'
import { AgentHubPeek } from './AgentHubPeek'
import { agentHubWorkArea } from './agent-hub-floating-arrangement'
import { agentHubPeekGeometry } from './agent-hub-peek-geometry'
import { closeAgentHubPeek, openAgentHubPeek, readAgentHubPeek } from './agent-hub-peek-store'
import type { MarkdownPreviewProps } from '../editor/markdown-preview/render-tree/markdown-preview-types'
import { openDetectedFilePath } from '../terminal-pane/links/files/terminal-file-open-routing'
import type * as TerminalFileOpenRouting from '../terminal-pane/links/files/terminal-file-open-routing'
import { handleTerminalFileLink } from '../terminal-pane/links/files/terminal-file-link-actions'
import { closeLeftoverAgentHubPeekPages } from './agent-hub-peek-pages'

const markdownPreview = vi.hoisted(() => vi.fn())
vi.mock('../terminal-pane/links/files/terminal-file-open-routing', async (importOriginal) => {
  const actual = await importOriginal<typeof TerminalFileOpenRouting>()
  return { ...actual, openDetectedFilePath: vi.fn() }
})
vi.mock('@/runtime/files/reads/runtime-file-read-client', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeFileClient>()
  return { ...actual, readRuntimeFileContent: vi.fn() }
})
vi.mock('@/lib/browser/navigation/http-link-routing', async (importOriginal) => {
  const actual = await importOriginal<typeof HttpLinkRouting>()
  return { ...actual, resolveLocalhostHttpLinkDisplayUrl: vi.fn(async () => null) }
})
vi.mock('../browser-pane/BrowserPane', () => ({
  default: ({ routingWorktreeId }: { routingWorktreeId?: string }) => (
    <output data-testid="browser-route">{routingWorktreeId ?? 'local'}</output>
  )
}))
vi.mock('../browser-pane/assemble-chrome/DeferredBrowserContent', () => ({
  DeferredBrowserContent: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('../editor/editor-lazy-views', () => ({
  MarkdownPreview: (props: MarkdownPreviewProps) => {
    markdownPreview(props)
    return (
      <article>
        <output>{props.content}</output>
        <a href="nested/next%20report.md#summary">
          <strong>Next report</strong>
        </a>
        <a href="https://example.com/report">External report</a>
        <a href="../source.ts#L12">Source file</a>
        <a href="#summary">Same-page heading</a>
      </article>
    )
  },
  ImageViewer: () => <output>file preview</output>,
  MonacoCodeExcerpt: ({ lines }: { lines: string[] }) => <output>{lines.join('\n')}</output>,
  MediaViewer: ({ canOpenLocally }: { canOpenLocally: boolean }) => (
    <output>{String(canOpenLocally)}</output>
  )
}))

const initial = useAppStore.getState()
const resetStore = (): void =>
  useAppStore.setState({
    ...initial,
    remoteBrowserPageHandlesByPageId: markHydratedBrowserPageHandles({
      ...initial.remoteBrowserPageHandlesByPageId
    })
  })
const WORKSPACE_ID = 'repo1::/workspace'
const readFile = vi.mocked(readRuntimeFileContent)

function seedOwner(hostId: ExecutionHostId, folder = false): string {
  const runtimeEnvironmentId = hostId.startsWith('runtime:') ? 'workhost' : null
  const connectionId = hostId.startsWith('ssh:') ? 'workhost-ssh' : null
  useAppStore.setState({
    settings: createGlobalSettingsFixture({
      experimentalAgentHub: true,
      activeRuntimeEnvironmentId: 'unrelated-runtime'
    }),
    repos: [{ ...TEST_REPO, executionHostId: hostId, connectionId }],
    worktreesByRepo: {
      repo1: [
        makeWorktree({
          id: WORKSPACE_ID,
          repoId: 'repo1',
          path: '/workspace',
          hostId,
          ...(runtimeEnvironmentId ? { runtimeOwnerEnvironmentId: runtimeEnvironmentId } : {})
        })
      ]
    },
    folderWorkspaces: folder
      ? [
          makeFolderWorkspace({
            id: 'folder-1',
            folderPath: '/workspace',
            executionHostId: hostId,
            connectionId
          })
        ]
      : [],
    runtimeEnvironmentCatalogHydrated: true
  })
  return folder ? 'folder:folder-1' : WORKSPACE_ID
}

beforeEach(() => {
  readFile.mockReset().mockResolvedValue({
    content: 'aGVsbG8=',
    isBinary: true,
    isImage: true,
    mimeType: 'image/png'
  })
  resetStore()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { shell: { openUrl: vi.fn() } }
  })
})
afterEach(() => {
  cleanup()
  closeAgentHubPeek()
  closeLeftoverAgentHubPeekPages()
  resetStore()
  vi.clearAllMocks()
})

describe('Peek Markdown', () => {
  it.each([
    ['local', false, null],
    ['ssh:workhost-ssh', false, null],
    ['runtime:workhost', false, 'workhost'],
    ['local', true, null],
    ['ssh:workhost-ssh', true, null],
    ['runtime:workhost', true, 'workhost']
  ] as const)(
    'renders text from %s, folder=%s, in the Markdown viewer',
    async (hostId, folder, runtimeId) => {
      const worktreeId = seedOwner(hostId, folder)
      readFile.mockResolvedValue({ content: '# Agent report', isBinary: false })
      const item = agentHubPeekFileItem('/workspace/report.md', {
        worktreeId,
        onPairedRuntime: runtimeId !== null,
        event: undefined,
        openInWorkspace: vi.fn(),
        openExternally: null
      })
      if (!item || item.content.kind === 'web') {
        throw new Error('Missing Markdown preview')
      }
      const onUnavailable = vi.fn()
      const onContentSize = vi.fn()
      render(
        <AgentHubPeekFile
          content={item.content}
          onContentSize={onContentSize}
          onUnavailable={onUnavailable}
        />
      )
      await screen.findByText('# Agent report')
      expect(markdownPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({
          content: '# Agent report',
          filePath: '/workspace/report.md',
          sourceWorktreeId: worktreeId,
          sourceRuntimeEnvironmentId: runtimeId,
          showTableOfContents: false,
          markdownAnnotationsEnabled: false
        })
      )
      expect(readFile).toHaveBeenCalledWith(
        expect.objectContaining({
          target:
            runtimeId === null
              ? { kind: 'local' }
              : { kind: 'environment', environmentId: runtimeId },
          worktreeId,
          filePath: '/workspace/report.md',
          ...(hostId === 'ssh:workhost-ssh' ? { connectionId: 'workhost-ssh' } : {})
        })
      )
      expect(onContentSize).toHaveBeenCalledWith(null)
      expect(onUnavailable).not.toHaveBeenCalled()
    }
  )

  it('labels and sizes Markdown, follows links in Peek history, and opens other files in the workspace', async () => {
    seedOwner('runtime:workhost')
    readFile.mockResolvedValue({ content: '# Agent report', isBinary: false })
    const item = agentHubPeekFileItem('/workspace/docs/report.md', {
      worktreeId: WORKSPACE_ID,
      onPairedRuntime: true,
      event: undefined,
      openInWorkspace: vi.fn(),
      openExternally: null
    })
    if (!item) {
      throw new Error('Missing Markdown Peek')
    }
    openAgentHubPeek({ ...item, mirrorKey: 'source-mirror' })
    render(
      <TooltipProvider>
        <AgentHubPeek />
      </TooltipProvider>
    )
    await screen.findByText('# Agent report')
    expect(screen.getByText('Markdown')).toBeTruthy()
    const dialog = screen.getByRole('dialog', { name: 'report.md' })
    expect(dialog.style.height).toBe(
      `${agentHubPeekGeometry(agentHubWorkArea(), null, false).height}px`
    )
    fireEvent.click(screen.getByText('Same-page heading'))
    expect(readAgentHubPeek()?.history).toHaveLength(1)
    fireEvent.click(screen.getByText('Next report'))
    await waitFor(() => expect(readAgentHubPeek()?.history).toHaveLength(2))
    expect(readAgentHubPeek()?.history[1]).toMatchObject({
      location: '/workspace/docs/nested/next report.md',
      mirrorKey: 'source-mirror',
      content: {
        kind: 'markdown',
        initialAnchor: 'summary',
        readContext: { target: { kind: 'environment', environmentId: 'workhost' } }
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Previous peek' }))
    await screen.findByText('# Agent report')
    fireEvent.click(screen.getByText('External report'))
    await waitFor(() =>
      expect(readAgentHubPeek()?.history[1]?.content).toMatchObject({
        kind: 'web',
        url: 'https://example.com/report',
        hostId: 'local'
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Previous peek' }))
    await screen.findByText('# Agent report')
    fireEvent.click(screen.getByText('Source file'))
    expect(readAgentHubPeek()).toBeNull()
    expect(openDetectedFilePath).toHaveBeenCalledWith(
      '/workspace/source.ts',
      12,
      null,
      expect.objectContaining({
        worktreeId: WORKSPACE_ID,
        worktreePath: '/workspace',
        runtimeEnvironmentId: 'workhost'
      })
    )
    expect(item.openInWorkspace).not.toHaveBeenCalled()
  })

  it('falls back once when a Markdown path returns binary content', async () => {
    const onUnavailable = vi.fn()
    render(
      <AgentHubPeekFile
        content={{ kind: 'markdown', filePath: '/workspace/report.md', connectionId: null }}
        onContentSize={vi.fn()}
        onUnavailable={onUnavailable}
      />
    )
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
    expect(markdownPreview).not.toHaveBeenCalled()
  })
})

describe('Peek file ownership', () => {
  it.each([
    ['local', false],
    ['ssh:workhost-ssh', true],
    ['runtime:workhost', false]
  ] as const)(
    'keeps a mirror source link location on %s, folder=%s, through Open in editor',
    async (hostId, folder) => {
      const worktreeId = seedOwner(hostId, folder)
      readFile.mockResolvedValue({ content: 'source preview', isBinary: false })
      render(
        <TooltipProvider>
          <AgentHubPeek />
        </TooltipProvider>
      )
      const mirror = document.createElement('div')
      mirror.dataset.agentHubMirror = ''
      mirror.dataset.agentHubMirrorKey = 'source-mirror'
      document.body.append(mirror)
      try {
        const event = new MouseEvent('click', {
          metaKey: navigator.userAgent.includes('Mac'),
          ctrlKey: !navigator.userAgent.includes('Mac')
        })
        Object.defineProperty(event, 'target', { value: mirror })
        const deps = {
          worktreeId,
          worktreePath: '/workspace',
          ...(hostId === 'runtime:workhost' ? { runtimeEnvironmentId: 'workhost' } : {})
        }
        act(() => {
          expect(handleTerminalFileLink('/workspace/src/main.ts', 120, 5, event, deps)).toBe(true)
        })
        await screen.findByText('source preview')
        expect(readAgentHubPeek()?.history[0]?.content).toMatchObject({
          kind: 'text',
          filePath: '/workspace/src/main.ts',
          line: 120,
          column: 5
        })
        expect(openDetectedFilePath).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }))
        expect(readAgentHubPeek()).toBeNull()
        expect(openDetectedFilePath).toHaveBeenCalledExactlyOnceWith(
          '/workspace/src/main.ts',
          120,
          5,
          deps
        )
      } finally {
        mirror.remove()
      }
    }
  )

  it.each([
    ['preview.png', 'local', false, null, undefined],
    ['preview.png', 'ssh:workhost-ssh', false, null, 'workhost-ssh'],
    ['preview.png', 'runtime:workhost', false, 'workhost', undefined],
    ['preview.png', 'local', true, null, undefined],
    ['preview.png', 'ssh:workhost-ssh', true, null, 'workhost-ssh'],
    ['preview.png', 'runtime:workhost', true, 'workhost', undefined],
    ['source.ts', 'local', false, null, undefined],
    ['source.ts', 'ssh:workhost-ssh', false, null, 'workhost-ssh'],
    ['source.ts', 'runtime:workhost', false, 'workhost', undefined],
    ['source.ts', 'local', true, null, undefined],
    ['source.ts', 'ssh:workhost-ssh', true, null, 'workhost-ssh'],
    ['source.ts', 'runtime:workhost', true, 'workhost', undefined]
  ] as const)(
    'reads %s from %s, folder=%s, while another runtime is selected',
    async (fileName, hostId, folder, environmentId, connectionId) => {
      const worktreeId = seedOwner(hostId, folder)
      if (fileName === 'source.ts') {
        readFile.mockResolvedValue({ content: 'file preview', isBinary: false })
      }
      const item = agentHubPeekFileItem(`/workspace/${fileName}`, {
        worktreeId,
        onPairedRuntime: environmentId !== null,
        event: undefined,
        openInWorkspace: vi.fn(),
        openExternally: null
      })
      if (!item || item.content.kind === 'web') {
        throw new Error('Missing file preview')
      }
      render(
        <AgentHubPeekFile content={item.content} onContentSize={vi.fn()} onUnavailable={vi.fn()} />
      )
      await screen.findByText('file preview')
      expect(readFile).toHaveBeenCalledWith(
        expect.objectContaining({
          target:
            environmentId === null ? { kind: 'local' } : { kind: 'environment', environmentId },
          worktreeId,
          filePath: `/workspace/${fileName}`,
          relativePath: fileName,
          ...(connectionId ? { connectionId } : {})
        })
      )
      expect(readFile.mock.calls[0]?.[0].connectionId).toBe(connectionId)
      if (hostId !== 'local') {
        expect(readFile.mock.calls[0]?.[0].access).toBeUndefined()
      }
    }
  )

  it('does not offer a paired path outside its owning workspace as a local read', () => {
    seedOwner('runtime:workhost')
    expect(
      agentHubPeekFileItem('/outside/preview.png', {
        worktreeId: WORKSPACE_ID,
        onPairedRuntime: true,
        event: undefined,
        openInWorkspace: vi.fn(),
        openExternally: null
      })
    ).toBeNull()
    expect(readFile).not.toHaveBeenCalled()
  })

  it('falls back once when the owning host cannot provide the preview', async () => {
    seedOwner('runtime:workhost')
    readFile.mockRejectedValue(new Error('remote unavailable'))
    const onUnavailable = vi.fn()
    render(
      <AgentHubPeekFile
        content={{
          kind: 'image',
          filePath: '/workspace/preview.png',
          connectionId: null,
          readContext: {
            target: { kind: 'environment', environmentId: 'workhost' },
            worktreeId: WORKSPACE_ID,
            relativePath: 'preview.png',
            filePath: '/workspace/preview.png'
          }
        }}
        onContentSize={vi.fn()}
        onUnavailable={onUnavailable}
      />
    )
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
  })
})

describe('private Peek pages', () => {
  it('keeps an SSH browser on the source route and removes its group when closed', async () => {
    seedOwner('ssh:workhost-ssh')
    const onUnavailable = vi.fn()
    const view = render(
      <AgentHubPeekBrowser
        url="http://localhost:5173/"
        hostId="ssh:workhost-ssh"
        routingWorktreeId={WORKSPACE_ID}
        onOpenPage={vi.fn()}
        onUnavailable={onUnavailable}
      />
    )
    await waitFor(() => expect(screen.getByTestId('browser-route').textContent).toBe(WORKSPACE_ID))
    expect(useAppStore.getState().groupsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toHaveLength(1)
    view.unmount()
    const state = useAppStore.getState()
    expect(state.browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
    expect(state.groupsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
    expect(state.unifiedTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
    expect(state.layoutByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
    expect(state.recentlyClosedBrowserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it.each([
    [['10.0.0.2'], true],
    [['127.0.0.1'], false],
    [[], false]
  ])('opens a host name that resolves here to %j: %s', async (addresses, opens) => {
    seedOwner('runtime:workhost')
    const lookup = vi.fn(async () => addresses)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { shell: { openUrl: vi.fn() }, hostNames: { lookup } }
    })
    const onUnavailable = vi.fn()
    render(
      <AgentHubPeekBrowser
        url="https://site.dev.test/"
        hostId="local"
        resolveNameHere
        onOpenPage={vi.fn()}
        onUnavailable={onUnavailable}
      />
    )
    await waitFor(() => expect(lookup).toHaveBeenCalledWith({ hostname: 'site.dev.test' }))
    if (opens) {
      await waitFor(() => expect(screen.getByTestId('browser-route').textContent).toBe('local'))
      expect(onUnavailable).not.toHaveBeenCalled()
    } else {
      await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
      expect(useAppStore.getState().browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeFalsy()
    }
  })

  it('removes stale empty groups even when no browser survived restart', () => {
    useAppStore.setState({ groupsByWorktree: { [AGENT_HUB_PEEK_WORKTREE_ID]: [] } })
    closeLeftoverAgentHubPeekPages()
    expect(useAppStore.getState().groupsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
  })
})
