// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkActionPopover } from '@/components/link-actions/LinkActionPopover'
import { TooltipProvider } from '@/components/ui/tooltip'
import { registerHttpLinkStoreAccessor } from '@/lib/browser/navigation/http-link-routing'
import type { LinkActionRequest } from '@/components/link-actions/link-action-request'
import {
  handleNativeChatWebLink,
  nativeChatWebPeekSource
} from '../native-chat/links/actions/native-chat-web-link-actions'
import { handleTerminalFileLink } from './links/files/terminal-file-link-actions'
import { handleTerminalHttpLink } from './links/http/terminal-url-link-hit-testing'
import type {
  TerminalLinkActionContext,
  TerminalLinkActionRequest
} from './links/terminal-link-action-request'
import {
  closeAgentHubPeek,
  readAgentHubPeek,
  registerAgentHubPeekHost
} from '../agent-hub/agent-hub-peek-store'

const mocks = vi.hoisted(() => {
  const ownership: { connectionId: string | null | undefined } = { connectionId: null }
  return {
    settings: { experimentalAgentHub: true },
    ...ownership,
    route: { executionHostId: 'local', runtimeEnvironmentId: null },
    openFile: vi.fn(),
    openUrl: vi.fn(),
    createBrowserTab: vi.fn(),
    openSettingsPage: vi.fn(),
    openSettingsTarget: vi.fn()
  }
})

vi.mock('@/store', () => ({
  useAppStore: Object.assign((select: (state: typeof mocks) => unknown) => select(mocks), {
    getState: () => mocks
  })
}))
vi.mock('@/lib/workspace/creation/surface-policy/client-creation-action-policy', () => ({
  getClientCreationActionPolicy: () => ({ 'managed-browser': { state: 'enabled' } })
}))
vi.mock('@/lib/workspace/ownership/worktree-operation-route', () => ({
  resolveWorktreeOperationRoute: () => mocks.route,
  resolveWorktreeOperationRouteForHost: () => mocks.route
}))
vi.mock('@/lib/workspace/ownership/connection-context', () => ({ getConnectionIdForFile: () => mocks.connectionId }))
vi.mock('@/lib/workspace/paths/workspace-directory', () => ({ resolveWorkspaceDirectory: () => '/repo' }))
vi.mock('./host-files/terminal-file-path-mapping', async (original) => ({
  ...(await original<object>()),
  getTerminalFileContext: () => ({ target: { kind: 'local' }, sourceHostResolved: true })
}))
vi.mock('./links/files/terminal-file-open-routing', () => ({
  getTerminalFileContext: () => ({ sourceHostResolved: true }),
  mapTerminalFilePath: (path: string) => path,
  openDetectedFilePath: mocks.openFile,
  shouldOpenTerminalFileWithSystemDefault: () => mocks.connectionId === null,
  terminalLinkWslDistro: () => null
}))
vi.mock('./links/files/terminal-worktree-path-link', () => ({
  resolveKnownWorktreeRootPathLink: () => null
}))

let unregisterHost = (): void => undefined

function linkClick(mirror: boolean, modifiers: MouseEventInit = {}): MouseEvent {
  const terminal = document.createElement('div')
  if (mirror) {
    terminal.setAttribute('data-agent-hub-mirror', '')
    terminal.dataset.agentHubMirrorKey = 'mirror-1'
  }
  document.body.append(terminal)
  const event = new MouseEvent('click', { button: 0, ...modifiers })
  Object.defineProperty(event, 'target', { value: terminal })
  return event
}

function captureActions(): {
  context: TerminalLinkActionContext
  requests: TerminalLinkActionRequest[]
} {
  const requests: TerminalLinkActionRequest[] = []
  return {
    requests,
    context: {
      paneId: 7,
      sourceOwner: { kind: 'local' },
      pointerGesture: { canRequestAction: () => true, dispose: vi.fn() },
      claimPtyMouse: () => true,
      focusTerminal: vi.fn(),
      request: (request) => requests.push(request)
    }
  }
}

function showActions(request: LinkActionRequest): void {
  render(
    <TooltipProvider>
      <LinkActionPopover request={request} onClose={vi.fn()} />
    </TooltipProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
  Object.assign(window, { api: { shell: { openUrl: mocks.openUrl } } })
  mocks.settings.experimentalAgentHub = true
  mocks.connectionId = null
  mocks.route.executionHostId = 'local'
  registerHttpLinkStoreAccessor(() => ({
    settings: { openLinksInApp: true },
    setActiveWorktree: vi.fn(),
    createBrowserTab: mocks.createBrowserTab
  }))
  unregisterHost = registerAgentHubPeekHost()
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  unregisterHost()
  closeAgentHubPeek()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('terminal Peek shortcut labels', () => {
  it.each([
    ['Macintosh', { metaKey: true }, '⌘'],
    ['Windows NT 10.0', { ctrlKey: true }, 'Ctrl'],
    ['Linux', { ctrlKey: true }, 'Ctrl']
  ] as const)(
    'opens Orb chat Peek and labels the actual destinations on %s',
    (userAgent, modifier, label) => {
      vi.stubGlobal('navigator', { userAgent })
      const requests: LinkActionRequest[] = []
      const url = 'https://example.com/orb-chat'
      const source = { worktreeId: 'wt-1', sourceOwner: { kind: 'local' } as const }
      const deps = {
        ...source,
        destinations: { primary: 'system', alternate: 'orca' } as const,
        actionsEnabled: true,
        restoreFocus: vi.fn(),
        request: (request: LinkActionRequest) => requests.push(request),
        peekSource: nativeChatWebPeekSource(url, source, linkClick(false), true)
      }
      handleNativeChatWebLink(linkClick(false), url, deps)
      showActions(requests[0])
      const peek = screen.getByRole('button', { name: /Peek/ })
      expect(within(peek).getByText(label)).toBeTruthy()
      expect(
        within(screen.getByRole('button', { name: /Orca Browser/ })).queryByText('Click')
      ).toBeNull()
      fireEvent.click(peek)
      expect(readAgentHubPeek()?.history[0]).toMatchObject({ location: url, fromOrb: true })
      closeAgentHubPeek()
      handleNativeChatWebLink(linkClick(false, modifier), url, deps)
      expect(readAgentHubPeek()?.history[0]?.location).toBe(url)
      closeAgentHubPeek()
      handleNativeChatWebLink(linkClick(false, { ...modifier, shiftKey: true }), url, deps)
      expect(readAgentHubPeek()).toBeNull()
      expect(mocks.openUrl).toHaveBeenCalledWith(url)
    }
  )
  it.each([
    ['Macintosh', { metaKey: true }, 'orca', 'system', '⌘', '⇧'],
    ['Windows NT 10.0', { ctrlKey: true }, 'system', 'orca', 'Ctrl', 'Shift'],
    ['Linux', { ctrlKey: true }, 'orca', 'system', 'Ctrl', 'Shift']
  ] as const)(
    'shows the actual mirror URL shortcuts on %s',
    (userAgent, modifier, primary, alternate, modifierLabel, shiftLabel) => {
      vi.stubGlobal('navigator', { userAgent })
      const { context, requests } = captureActions()
      const deps = {
        worktreeId: 'wt-1',
        sourceOwner: { kind: 'local' as const },
        linkActionContext: context,
        actionDestinations: { primary, alternate }
      }
      const url = 'https://example.com/artifact/test'
      handleTerminalHttpLink(url, linkClick(true), deps)
      showActions(requests[0])

      const peek = screen.getByRole('button', { name: /Peek/ })
      const primaryBrowser = screen.getByRole('button', {
        name: primary === 'orca' ? /Orca Browser/ : /System Browser/
      })
      const alternateBrowser = screen.getByRole('button', {
        name: alternate === 'orca' ? /Orca Browser/ : /System Browser/
      })
      expect(within(peek).getByText(modifierLabel)).toBeTruthy()
      expect(within(peek).getByText('Click')).toBeTruthy()
      expect(within(peek).queryByText(shiftLabel)).toBeNull()
      expect(within(primaryBrowser).queryByText('Click')).toBeNull()
      expect(within(alternateBrowser).getByText(shiftLabel)).toBeTruthy()

      fireEvent.click(peek)
      expect(readAgentHubPeek()?.history[0]).toMatchObject({ location: url, mirrorKey: 'mirror-1' })
      closeAgentHubPeek()
      handleTerminalHttpLink(url, linkClick(true, modifier), deps)
      expect(readAgentHubPeek()?.history[0]?.location).toBe(url)
      closeAgentHubPeek()
      handleTerminalHttpLink(url, linkClick(true, { ...modifier, shiftKey: true }), deps)
      expect(readAgentHubPeek()).toBeNull()
      expect(alternate === 'orca' ? mocks.createBrowserTab : mocks.openUrl).toHaveBeenCalled()

      vi.clearAllMocks()
      fireEvent.click(primaryBrowser)
      expect(primary === 'orca' ? mocks.createBrowserTab : mocks.openUrl).toHaveBeenCalled()
      expect(readAgentHubPeek()).toBeNull()
    }
  )

  it.each([false, true])(
    'keeps browser shortcuts when Peek does not intercept (mirror: %s)',
    (mirror) => {
      mocks.settings.experimentalAgentHub = !mirror
      const { context, requests } = captureActions()
      const deps = {
        worktreeId: 'wt-1',
        linkActionContext: context,
        actionDestinations: { primary: 'orca' as const, alternate: 'system' as const }
      }
      handleTerminalHttpLink('https://example.com', linkClick(mirror), deps)
      showActions(requests[0])

      expect(
        within(screen.getByRole('button', { name: /Orca Browser/ })).getByText('⌘')
      ).toBeTruthy()
      const peek = screen.queryByRole('button', { name: /Peek/ })
      if (peek) {
        expect(within(peek).queryByText('Click')).toBeNull()
      }
      handleTerminalHttpLink('https://example.com', linkClick(mirror, { metaKey: true }), deps)
      expect(mocks.createBrowserTab).toHaveBeenCalled()
      expect(readAgentHubPeek()).toBeNull()
    }
  )

  it.each([null, 'ssh-1'])('distinguishes file opening from Peek for owner %s', (connectionId) => {
    mocks.connectionId = connectionId
    mocks.route.executionHostId = connectionId ? `ssh:${connectionId}` : 'local'
    const { context, requests } = captureActions()
    const deps = { worktreeId: 'wt-1', worktreePath: '/repo' }
    const path = '/repo/report.md'
    handleTerminalFileLink(path, 12, 4, linkClick(true), deps, context)
    showActions(requests[0])

    const peek = screen.getByRole('button', { name: /Peek/ })
    const openFile = screen.getByRole('button', { name: /^Open file/ })
    expect(within(peek).getByText('⌘')).toBeTruthy()
    expect(within(openFile).queryByText('Click')).toBeNull()
    expect(within(screen.getByRole('button', { name: /default app/ })).getByText('⇧')).toBeTruthy()
    fireEvent.click(peek)
    expect(readAgentHubPeek()?.history[0]?.content).toMatchObject({
      kind: 'markdown',
      filePath: path,
      connectionId
    })
    closeAgentHubPeek()
    handleTerminalFileLink(path, 12, 4, linkClick(true, { metaKey: true }), deps, context)
    expect(readAgentHubPeek()?.history[0]?.location).toBe(path)
    closeAgentHubPeek()
    handleTerminalFileLink(
      path,
      12,
      4,
      linkClick(true, { metaKey: true, shiftKey: true }),
      deps,
      context
    )
    expect(readAgentHubPeek()).toBeNull()
    expect(mocks.openFile).toHaveBeenCalledWith(path, 12, 4, {
      ...deps,
      openWithSystemDefault: true
    })
    fireEvent.click(openFile)
    expect(mocks.openFile).toHaveBeenLastCalledWith(path, 12, 4, deps)
  })

  it('keeps Shift on the only browser destination while the unshifted shortcut peeks', () => {
    const { context, requests } = captureActions()
    const deps = {
      worktreeId: 'wt-1',
      linkActionContext: context,
      actionDestinations: { primary: 'system' as const }
    }
    handleTerminalHttpLink('https://example.com', linkClick(true), deps)
    showActions(requests[0])

    expect(within(screen.getByRole('button', { name: /Peek/ })).getByText('⌘')).toBeTruthy()
    expect(
      within(screen.getByRole('button', { name: /System Browser/ })).getByText('⇧')
    ).toBeTruthy()
    handleTerminalHttpLink(
      'https://example.com',
      linkClick(true, { metaKey: true, shiftKey: true }),
      deps
    )
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com')
    expect(readAgentHubPeek()).toBeNull()
  })

  it('does not advertise a Peek shortcut before the file owner has loaded', () => {
    mocks.connectionId = undefined
    const { context, requests } = captureActions()
    const deps = { worktreeId: 'wt-1', worktreePath: '/repo' }
    handleTerminalFileLink('/repo/report.md', null, null, linkClick(true), deps, context)
    showActions(requests[0])

    expect(within(screen.getByRole('button', { name: /^Open file/ })).getByText('⌘')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /Peek/ })).queryByText('Click')).toBeNull()
    handleTerminalFileLink(
      '/repo/report.md',
      null,
      null,
      linkClick(true, { metaKey: true }),
      deps,
      context
    )
    expect(mocks.openFile).toHaveBeenCalled()
    expect(readAgentHubPeek()).toBeNull()
  })
})
