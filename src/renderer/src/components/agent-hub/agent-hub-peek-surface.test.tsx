/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { AGENT_HUB_PEEK_WORKTREE_ID } from '../../../../shared/agent-hub-peek-workspace'
import {
  makeFolderWorkspace,
  makeWorktree,
  TEST_REPO
} from '@/store/slices/worktrees-slice-test-fixtures'
import { readRuntimeFileContent } from '@/runtime/runtime-file-read-client'
import type * as RuntimeFileClient from '@/runtime/runtime-file-read-client'
import type * as HttpLinkRouting from '@/lib/http-link-routing'
import { agentHubPeekFileItem } from './agent-hub-peek-routing'
import { AgentHubPeekBrowser } from './AgentHubPeekBrowser'
import { AgentHubPeekFile } from './AgentHubPeekFile'
import { closeLeftoverAgentHubPeekPages } from './agent-hub-peek-pages'

vi.mock('@/runtime/runtime-file-read-client', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeFileClient>()
  return { ...actual, readRuntimeFileContent: vi.fn() }
})
vi.mock('@/lib/http-link-routing', async (importOriginal) => {
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
  ImageViewer: () => <output>file preview</output>,
  MediaViewer: ({ canOpenLocally }: { canOpenLocally: boolean }) => (
    <output>{String(canOpenLocally)}</output>
  )
}))

const initial = useAppStore.getState()
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
  useAppStore.setState(initial)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { shell: { openUrl: vi.fn() } }
  })
})
afterEach(() => {
  cleanup()
  closeLeftoverAgentHubPeekPages()
  useAppStore.setState(initial)
  vi.clearAllMocks()
})

describe('Peek file ownership', () => {
  it.each([
    ['local', false, null, undefined],
    ['ssh:workhost-ssh', false, null, 'workhost-ssh'],
    ['runtime:workhost', false, 'workhost', undefined],
    ['local', true, null, undefined],
    ['ssh:workhost-ssh', true, null, 'workhost-ssh'],
    ['runtime:workhost', true, 'workhost', undefined]
  ] as const)(
    'reads %s files from their owner, folder=%s, while another runtime is selected',
    async (hostId, folder, environmentId, connectionId) => {
      const worktreeId = seedOwner(hostId, folder)
      const item = agentHubPeekFileItem('/workspace/preview.png', {
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
          target: environmentId ? { kind: 'environment', environmentId } : { kind: 'local' },
          worktreeId,
          filePath: '/workspace/preview.png',
          relativePath: 'preview.png',
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

  it('removes stale empty groups even when no browser survived restart', () => {
    useAppStore.setState({ groupsByWorktree: { [AGENT_HUB_PEEK_WORKTREE_ID]: [] } })
    closeLeftoverAgentHubPeekPages()
    expect(useAppStore.getState().groupsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]).toBeUndefined()
  })
})
