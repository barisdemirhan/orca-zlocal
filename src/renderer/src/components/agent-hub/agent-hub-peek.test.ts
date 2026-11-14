/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortForwardEntry } from '../../../../shared/ssh-types'
import { openWorkspaceBrowserTab } from '@/lib/browser/workspace/workspace-browser-tab-open'
import { toast } from 'sonner'

const mocks = vi.hoisted(() => {
  const state: {
    settings: { experimentalAgentHub: boolean; browserClientHostedRemoteEnabled?: boolean }
    connectionId: string | null | undefined
    browser: 'enabled' | 'hidden'
    route: { executionHostId: string; runtimeEnvironmentId: string | null }
    portForwardsByConnection: Record<string, PortForwardEntry[]>
    runtimeEnvironments: {
      id: string
      sshAccess?: { sshTargetId: string }
      orcadDeployment?: { kind: 'ssh'; sshTargetId: string; sshTargetGeneration: number }
    }[]
  } = {
    settings: { experimentalAgentHub: true },
    connectionId: null,
    browser: 'enabled',
    route: { executionHostId: 'local', runtimeEnvironmentId: null },
    portForwardsByConnection: {},
    runtimeEnvironments: []
  }
  return state
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks } }))
vi.mock('@/lib/workspace/ownership/connection-context', () => ({
  getConnectionIdForFile: () => mocks.connectionId
}))
vi.mock('@/lib/workspace/creation/surface-policy/client-creation-action-policy', () => ({
  getClientCreationActionPolicy: () => ({ 'managed-browser': { state: mocks.browser } })
}))
vi.mock('@/lib/workspace/ownership/worktree-operation-route', () => ({
  resolveWorktreeOperationRoute: () => mocks.route,
  resolveWorktreeOperationRouteForHost: () => mocks.route
}))
vi.mock('../terminal-pane/host-files/terminal-file-path-mapping', () => ({
  getTerminalFileContext: () => ({
    target: mocks.route.runtimeEnvironmentId
      ? { kind: 'environment', environmentId: mocks.route.runtimeEnvironmentId }
      : { kind: 'local' },
    sourceHostResolved: true
  })
}))
vi.mock('@/lib/workspace/paths/workspace-directory', () => ({ resolveWorkspaceDirectory: () => '/a' }))
vi.mock('@/lib/browser/workspace/workspace-browser-tab-open', () => ({
  openWorkspaceBrowserTab: vi.fn(async () => {})
}))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/editor/markdown/link-routing/markdown-internal-links', () => ({
  absolutePathToFileUri: (path: string) => `file://${path}`
}))

import {
  agentHubPeekFileAction,
  agentHubPeekUrlAction,
  peekTerminalFileFromMirror,
  peekTerminalUrlFromMirror,
  type AgentHubPeekLinkSource
} from './agent-hub-peek-routing'
import { agentHubPeekPageItem } from './agent-hub-peek-page-navigation'
import {
  closeAgentHubPeek,
  goBackAgentHubPeek,
  readAgentHubPeek,
  registerAgentHubPeekHost
} from './agent-hub-peek-store'

let unregisterHost = (): void => undefined

function clickIn(mirrorKey: string | null): MouseEvent {
  const terminal = document.createElement('div')
  if (mirrorKey) {
    const mirror = document.createElement('section')
    mirror.setAttribute('data-agent-hub-mirror', '')
    mirror.dataset.agentHubMirrorKey = mirrorKey
    mirror.append(terminal)
    document.body.append(mirror)
  } else {
    document.body.append(terminal)
  }
  const event = new MouseEvent('click', { metaKey: true })
  Object.defineProperty(event, 'target', { value: terminal })
  return event
}

function source(event: MouseEvent | undefined, onPairedRuntime = false): AgentHubPeekLinkSource {
  return {
    worktreeId: 'wt-1',
    onPairedRuntime,
    event,
    openInWorkspace: vi.fn(),
    openExternally: null
  }
}

const shown = () => {
  const peek = readAgentHubPeek()
  return peek ? peek.history[peek.index] : null
}

beforeEach(() => {
  mocks.settings = { experimentalAgentHub: true }
  mocks.connectionId = null
  mocks.browser = 'enabled'
  mocks.route = { executionHostId: 'local', runtimeEnvironmentId: null }
  mocks.portForwardsByConnection = {}
  mocks.runtimeEnvironments = []
  vi.clearAllMocks()
  unregisterHost = registerAgentHubPeekHost()
})
afterEach(() => {
  unregisterHost()
  closeAgentHubPeek()
  document.body.replaceChildren()
})

describe('a direct click in a mirror', () => {
  it('peeks at a page and names the mirror it came from', () => {
    expect(peekTerminalUrlFromMirror('http://127.0.0.1:6007/', source(clickIn('m-1')))).toBe(true)
    expect(shown()).toMatchObject({
      content: { kind: 'web', url: 'http://127.0.0.1:6007/', hostId: 'local' },
      title: '127.0.0.1:6007',
      mirrorKey: 'm-1'
    })
  })

  it.each([
    ['/a/contact-tr.png', { kind: 'image', filePath: '/a/contact-tr.png', connectionId: null }],
    ['/a/store-review.PDF', { kind: 'pdf' }],
    ['/a/flow.mp4', { kind: 'media' }],
    ['/a/README.md', { kind: 'markdown', filePath: '/a/README.md', connectionId: null }],
    ['/a/report.MARKDOWN', { kind: 'markdown' }],
    ['/a/docs.mdx', { kind: 'markdown' }],
    ['/a/data.csv', { kind: 'csv' }],
    ['/a/data.tsv', { kind: 'csv' }],
    ['/a/flow.mmd', { kind: 'mermaid' }],
    ['/a/flow.mermaid', { kind: 'mermaid' }],
    ['/a/analysis.ipynb', { kind: 'notebook' }],
    ['/a/main.ts', { kind: 'text' }],
    ['/a/server.log', { kind: 'text' }],
    ['/a/Makefile', { kind: 'text' }],
    ['/a/report.html', { kind: 'web', url: 'file:///a/report.html' }]
  ])('peeks at %s', (filePath, content) => {
    expect(peekTerminalFileFromMirror(filePath, source(clickIn('m-1')))).toBe(true)
    expect(shown()?.content).toMatchObject(content)
  })

  it.each([
    ['outside a mirror', () => clickIn(null), true, '/a/shot.png', null],
    ['with Agent Hub off', () => clickIn('m-1'), false, '/a/shot.png', null],
    ['for a file Peek cannot show', () => clickIn('m-1'), true, '/a/archive.zip', null],
    ['before the file owner has loaded', () => clickIn('m-1'), true, '/a/shot.png', undefined]
  ])('leaves the click to Orca %s', (_, event, enabled, filePath, connectionId) => {
    mocks.settings = { experimentalAgentHub: enabled }
    mocks.connectionId = connectionId
    expect(peekTerminalFileFromMirror(filePath, source(event()))).toBe(false)
    expect(readAgentHubPeek()).toBeNull()
  })
})

describe('an SSH workspace', () => {
  it('allows Markdown and retains its SSH read context', () => {
    mocks.route = { executionHostId: 'ssh:workhost', runtimeEnvironmentId: null }
    mocks.connectionId = 'workhost'
    const linkSource = source(clickIn('m-1'))
    expect(peekTerminalFileFromMirror('/a/report.md', linkSource)).toBe(true)
    expect(shown()?.content).toMatchObject({
      kind: 'markdown',
      connectionId: 'workhost',
      readContext: { filePath: '/a/report.md', relativePath: 'report.md', connectionId: 'workhost' }
    })
    expect(linkSource.openInWorkspace).not.toHaveBeenCalled()
  })
  it('opens remote HTML through its workspace document preview with a reason', () => {
    mocks.route = { executionHostId: 'ssh:workhost', runtimeEnvironmentId: null }
    mocks.connectionId = 'workhost'
    const linkSource = source(clickIn('m-1'))
    expect(peekTerminalFileFromMirror('/a/report.html', linkSource)).toBe(true)
    expect(linkSource.openInWorkspace).toHaveBeenCalledOnce()
    expect(readAgentHubPeek()).toBeNull()
    expect(toast.info).toHaveBeenCalledWith(
      'This preview is unavailable here. Opening in the workspace.'
    )
  })
  it('loads its pages through the SSH host, where its localhost is', () => {
    mocks.route = { executionHostId: 'ssh:workhost', runtimeEnvironmentId: null }
    expect(peekTerminalUrlFromMirror('http://localhost:5173/', source(clickIn('m-1')))).toBe(true)
    expect(shown()?.content).toMatchObject({
      kind: 'web',
      url: 'http://localhost:5173/',
      hostId: 'ssh:workhost'
    })
  })

  it('reads its images, PDFs and media over the SSH connection', () => {
    mocks.connectionId = 'ssh-1'
    expect(peekTerminalFileFromMirror('/home/dev/shot.png', source(clickIn('m-1')))).toBe(true)
    expect(shown()?.content).toMatchObject({
      kind: 'image',
      filePath: '/home/dev/shot.png',
      connectionId: 'ssh-1'
    })
  })
})

it.each([['a workspace whose browser is off', false, 'hidden', null]] as const)(
  'leaves a page from %s to Orca',
  (_, pairedRuntime, browser, runtimeEnvironmentId) => {
    mocks.browser = browser
    mocks.route = { executionHostId: 'local', runtimeEnvironmentId }
    expect(
      peekTerminalUrlFromMirror('http://localhost:5173/', source(clickIn('m-1'), pairedRuntime))
    ).toBe(false)
    expect(readAgentHubPeek()).toBeNull()
  }
)

describe('a paired workspace', () => {
  const pairedSource = (): AgentHubPeekLinkSource => ({
    ...source(clickIn('m-1'), true),
    sourceOwner: { kind: 'runtime', runtimeEnvironmentId: 'workhost' }
  })

  beforeEach(() => {
    mocks.route = { executionHostId: 'runtime:workhost', runtimeEnvironmentId: 'workhost' }
    mocks.runtimeEnvironments = [{ id: 'workhost', sshAccess: { sshTargetId: 'workhost-ssh' } }]
  })

  it('allows Markdown through its runtime owner without a local file grant', () => {
    const linkSource = pairedSource()
    expect(peekTerminalFileFromMirror('/a/report.md', linkSource)).toBe(true)
    expect(shown()?.content).toMatchObject({
      kind: 'markdown',
      connectionId: null,
      readContext: {
        target: { kind: 'environment', environmentId: 'workhost' },
        worktreeId: 'wt-1',
        relativePath: 'report.md'
      }
    })
    const content = shown()?.content
    expect(content && content.kind !== 'web' ? content.readContext?.access : null).toBeUndefined()
    expect(linkSource.openInWorkspace).not.toHaveBeenCalled()
  })

  it('embeds a public domain without creating a host browser tab', () => {
    expect(peekTerminalUrlFromMirror('https://github.com/stablyai/orca', pairedSource())).toBe(true)
    expect(shown()?.content).toMatchObject({
      kind: 'web',
      url: 'https://github.com/stablyai/orca',
      hostId: 'local'
    })
  })

  it.each([
    ['https://site.dev.test/path', false],
    ['http://devbox:3000/', false],
    ['http://10.0.0.2/', false],
    ['http://10.0.0.2/', true]
  ])(
    'opens the host-resolved address %s in the paired workspace browser (on this device: %s)',
    (url, onThisDevice) => {
      mocks.settings.browserClientHostedRemoteEnabled = onThisDevice
      expect(peekTerminalUrlFromMirror(url, pairedSource())).toBe(true)
      expect(shown()).toBeNull()
      expect(openWorkspaceBrowserTab).toHaveBeenCalledWith(
        expect.objectContaining({ url, expectedRuntimeEnvironmentId: 'workhost' })
      )
      expect(toast.info).toHaveBeenCalledWith(
        'This address is only available on its host. Opening in the workspace browser.'
      )
    }
  )

  it('peeks at a host name on this device when browsing there, if it resolves here', () => {
    expect(peekTerminalUrlFromMirror('https://site.dev.test/path', pairedSource())).toBe(true)
    expect(shown()?.content).toEqual({
      kind: 'web',
      url: 'https://site.dev.test/path',
      hostId: 'local',
      resolveNameHere: true
    })
    expect(openWorkspaceBrowserTab).not.toHaveBeenCalled()
  })

  it.each(['https://site.dev.test/path', 'http://localhost:5173/'])(
    'routes %s over an SSH-deployed server’s SSH route',
    (url) => {
      mocks.runtimeEnvironments = [
        {
          id: 'workhost',
          orcadDeployment: { kind: 'ssh', sshTargetId: 'workhost-ssh', sshTargetGeneration: 1 }
        }
      ]
      expect(peekTerminalUrlFromMirror(url, pairedSource())).toBe(true)
      expect(shown()?.content).toMatchObject({
        kind: 'web',
        url,
        hostId: 'local',
        routeHostId: 'runtime:workhost',
        routingWorktreeId: 'wt-1'
      })
    }
  )

  it.each(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])(
    'uses an existing host-specific forward for %s',
    (host) => {
      mocks.portForwardsByConnection = {
        other: [
          {
            id: 'wrong',
            connectionId: 'other',
            remoteHost: '127.0.0.1',
            remotePort: 5173,
            localPort: 45111
          }
        ],
        'workhost-ssh': [
          {
            id: 'workhost',
            connectionId: 'workhost-ssh',
            remoteHost: '127.0.0.1',
            remotePort: 5173,
            localPort: 45173
          }
        ]
      }
      expect(
        peekTerminalUrlFromMirror(`http://${host}:5173/path?q=1#section`, pairedSource())
      ).toBe(true)
      expect(shown()?.content).toMatchObject({
        hostId: 'local',
        url: 'http://127.0.0.1:45173/path?q=1#section'
      })
    }
  )

  it('opens an unforwarded host address through the normal paired workspace browser with a reason', () => {
    const linkSource = pairedSource()
    expect(peekTerminalUrlFromMirror('http://localhost:5173/path', linkSource)).toBe(true)
    expect(readAgentHubPeek()).toBeNull()
    expect(openWorkspaceBrowserTab).toHaveBeenCalledWith({
      workspaceId: 'wt-1',
      url: 'http://localhost:5173/path',
      intent: { kind: 'url' },
      expectedRuntimeEnvironmentId: 'workhost'
    })
    expect(toast.info).toHaveBeenCalledWith(
      'This address is only available on its host. Opening in the workspace browser.'
    )
    expect(linkSource.openInWorkspace).not.toHaveBeenCalled()
  })

  it('cannot use another host’s same-port forward', () => {
    mocks.portForwardsByConnection = {
      other: [
        {
          id: 'wrong',
          connectionId: 'other',
          remoteHost: '127.0.0.1',
          remotePort: 5173,
          localPort: 45111
        }
      ]
    }
    expect(peekTerminalUrlFromMirror('http://127.0.0.1:5173/', pairedSource())).toBe(true)
    expect(shown()).toBeNull()
    expect(openWorkspaceBrowserTab).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRuntimeEnvironmentId: 'workhost' })
    )
  })

  it('keeps a page popup on the forwarded origin already hosting Peek', () => {
    mocks.portForwardsByConnection = {
      'workhost-ssh': [
        {
          id: 'workhost',
          connectionId: 'workhost-ssh',
          remoteHost: '127.0.0.1',
          remotePort: 5173,
          localPort: 45173
        }
      ]
    }
    peekTerminalUrlFromMirror('http://localhost:5173/', pairedSource())
    const item = shown()
    if (!item) {
      throw new Error('Missing forwarded Peek')
    }
    expect(agentHubPeekPageItem(item, 'http://127.0.0.1:45173/next')?.content).toMatchObject({
      hostId: 'local',
      url: 'http://127.0.0.1:45173/next'
    })
    expect(openWorkspaceBrowserTab).not.toHaveBeenCalled()
  })
})

describe('the link menu row', () => {
  it('is offered in any terminal while Agent Hub is on and opens Peek', () => {
    const row = agentHubPeekUrlAction('https://example.com/run/1', source(clickIn(null)))
    expect(row?.label).toBe('Peek')
    void row?.run()
    expect(shown()).toMatchObject({ content: { kind: 'web' }, mirrorKey: null })
  })

  it('is absent with Agent Hub off', () => {
    mocks.settings = { experimentalAgentHub: false }
    expect(agentHubPeekFileAction('/a/shot.png', source(undefined))).toBeNull()
  })

  it('is absent while nothing can show a Peek', () => {
    unregisterHost()
    unregisterHost = () => undefined
    expect(agentHubPeekFileAction('/a/shot.png', source(undefined))).toBeNull()
  })
})

describe('one Peek at a time', () => {
  it('replaces what is shown, steps back, and treats a repeat as the same step', () => {
    const at = (path: string): boolean => peekTerminalFileFromMirror(path, source(clickIn('m-1')))
    at('/a/one.png')
    at('/a/two.pdf')
    at('/a/two.pdf')
    expect(readAgentHubPeek()?.history.map((item) => item.location)).toEqual([
      '/a/one.png',
      '/a/two.pdf'
    ])
    goBackAgentHubPeek()
    expect(shown()?.location).toBe('/a/one.png')
    at('/a/three.mp4')
    expect(readAgentHubPeek()?.history.map((item) => item.location)).toEqual([
      '/a/one.png',
      '/a/three.mp4'
    ])
    closeAgentHubPeek()
    expect(readAgentHubPeek()).toBeNull()
  })
})
