import { translate } from '@/i18n/i18n'
import type { LinkAction } from '@/components/link-actions/link-action-request'
import { PictureInPicture2 } from 'lucide-react'
import { absolutePathToFileUri } from '@/components/editor/markdown/link-routing/markdown-internal-links'
import { getConnectionIdForFile } from '@/lib/connection-context'
import { resolveWorkspaceDirectory } from '@/lib/workspace-directory'
import { getTerminalFileContext } from '../terminal-pane/host-files/terminal-file-path-mapping'
import { getRelativePathInsideWorktree } from '@/runtime/runtime-file-routing'
import { userNamedFileAccess } from '@/lib/local-file-access'
import type { HttpLinkSourceOwner } from '@/lib/browser/navigation/http-link-routing'
import { openWorkspaceBrowserTab } from '@/lib/browser/workspace/workspace-browser-tab-open'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'
import {
  agentHubPeekBrowserRoute,
  agentHubPeekSourceRoute,
  isAgentHubPeekHostAddress
} from './agent-hub-peek-browser-route'
import { agentHubMirrorWindowIdOf } from './agent-hub-mirror-element'
import { agentHubPeekPageTitle } from './agent-hub-peek-page-navigation'
import { agentHubPeekFileKind } from './agent-hub-peek-file-kind'

export { agentHubPeekFileKind } from './agent-hub-peek-file-kind'
import {
  isAgentHubPeekHostMounted,
  closeAgentHubPeek,
  openAgentHubPeek,
  type AgentHubPeekItem
} from './agent-hub-peek-store'

/** Where a terminal link was clicked, and the ways out it already had before Peek. */
export type AgentHubPeekLinkSource = {
  worktreeId: string
  onPairedRuntime: boolean
  sourceOwner?: HttpLinkSourceOwner
  worktreePath?: string
  line?: number | null
  column?: number | null
  event: Pick<MouseEvent, 'target'> | undefined
  previewOnModifier?: boolean
  fromOrb?: boolean
  openInWorkspace: () => void
  openExternally: (() => void) | null
}

function peekEnabled(source: AgentHubPeekLinkSource): boolean {
  return (
    source.sourceOwner?.kind !== 'unknown' &&
    useAppStore.getState().settings?.experimentalAgentHub === true &&
    isAgentHubPeekHostMounted()
  )
}

function mirrorKeyOf(event: Pick<MouseEvent, 'target'> | undefined): string | null {
  return event?.target instanceof Element ? agentHubMirrorWindowIdOf(event.target) : null
}

export function agentHubPeekUrlItem(
  url: string,
  source: AgentHubPeekLinkSource
): AgentHubPeekItem | null {
  const content = agentHubPeekBrowserRoute(url, source)
  if (!content) {
    return null
  }
  return {
    content,
    worktreeId: source.worktreeId,
    title: agentHubPeekPageTitle(url),
    location: url,
    mirrorKey: mirrorKeyOf(source.event),
    fromOrb: source.fromOrb,
    openInWorkspace: source.openInWorkspace,
    openExternally: source.openExternally
  }
}

export function agentHubPeekFileItem(
  filePath: string,
  source: AgentHubPeekLinkSource
): AgentHubPeekItem | null {
  const kind = agentHubPeekFileKind(filePath)
  if (!kind) {
    return null
  }
  const route = agentHubPeekSourceRoute(source)
  if (!route) {
    return null
  }
  const connectionId = getConnectionIdForFile(source.worktreeId, filePath)
  // Why: undefined means the owner has not loaded yet, which is neither local nor a known host.
  if (connectionId === undefined && !route.runtimeEnvironmentId) {
    return null
  }
  let content: AgentHubPeekItem['content']
  if (kind === 'html') {
    // Why local only: a file:// page loads from this disk, which a remote host's file is not on.
    if (connectionId !== null || route.runtimeEnvironmentId) {
      return null
    }
    content = { kind: 'web', url: absolutePathToFileUri(filePath), hostId: 'local' }
  } else {
    const worktreePath =
      source.worktreePath ??
      resolveWorkspaceDirectory(useAppStore.getState(), source.worktreeId, route.executionHostId)
    if (!worktreePath) {
      return null
    }
    const context = getTerminalFileContext(
      source.worktreeId,
      worktreePath,
      route.runtimeEnvironmentId
    )
    if (!context.sourceHostResolved) {
      return null
    }
    const relativePath = getRelativePathInsideWorktree(worktreePath, filePath)
    if (route.runtimeEnvironmentId && !relativePath) {
      return null
    }
    const sshConnectionId = route.runtimeEnvironmentId
      ? null
      : (connectionId ?? context.connectionId ?? null)
    content = {
      kind,
      filePath,
      connectionId: sshConnectionId,
      ...(source.line != null ? { line: source.line } : {}),
      ...(source.column != null ? { column: source.column } : {}),
      readContext: {
        target: context.target,
        worktreeId: source.worktreeId,
        filePath,
        ...(relativePath ? { relativePath } : {}),
        ...(sshConnectionId
          ? { connectionId: sshConnectionId, expectedExternalSshTargetId: sshConnectionId }
          : {}),
        ...(!route.runtimeEnvironmentId && !sshConnectionId
          ? { access: userNamedFileAccess() }
          : {})
      }
    }
  }
  return {
    content,
    worktreeId: source.worktreeId,
    title: filePath.split(/[/\\]/).pop() || filePath,
    location: filePath,
    mirrorKey: mirrorKeyOf(source.event),
    fromOrb: source.fromOrb,
    openInWorkspace: source.openInWorkspace,
    openExternally: source.openExternally
  }
}

/** Uses the source's normal browser when a host-only address has no client forward. */
export async function openAgentHubPeekUrl(
  url: string,
  source: AgentHubPeekLinkSource,
  preserveKeyboardFocus = false
): Promise<void> {
  const item = agentHubPeekUrlItem(url, source)
  if (item) {
    openAgentHubPeek({ ...item, preserveKeyboardFocus })
    return
  }
  const route = agentHubPeekSourceRoute(source)
  if (!route) {
    throw new Error(
      translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
    )
  }
  toast.info(
    route.runtimeEnvironmentId && isAgentHubPeekHostAddress(url)
      ? translate(
          'agentHub.peek.hostAddress',
          'This address is only available on its host. Opening in the workspace browser.'
        )
      : translate(
          'agentHub.peek.workspaceFallback',
          'This preview is unavailable here. Opening in the workspace.'
        )
  )
  await openWorkspaceBrowserTab({
    workspaceId: source.worktreeId,
    url,
    intent: { kind: 'url' },
    ...(route?.runtimeEnvironmentId
      ? { expectedRuntimeEnvironmentId: route.runtimeEnvironmentId }
      : {})
  })
}

function openPeekUrlWithFeedback(url: string, source: AgentHubPeekLinkSource): void {
  void openAgentHubPeekUrl(url, source).catch((error) =>
    toast.error(
      error instanceof Error
        ? error.message
        : translate('agentHub.peek.unavailable', 'This link could not be opened.')
    )
  )
}

export function fallbackAgentHubPeek(item: AgentHubPeekItem): void {
  closeAgentHubPeek()
  toast.info(
    item.content.kind === 'web' && item.content.resolveNameHere
      ? translate(
          'agentHub.peek.hostAddress',
          'This address is only available on its host. Opening in the workspace browser.'
        )
      : translate(
          'agentHub.peek.workspaceFallback',
          'This preview is unavailable here. Opening in the workspace.'
        )
  )
  item.openInWorkspace()
}

export function openAgentHubPeekFile(
  filePath: string,
  source: AgentHubPeekLinkSource,
  preserveKeyboardFocus = false
): boolean {
  const item = agentHubPeekFileItem(filePath, source)
  if (item) {
    openAgentHubPeek({ ...item, preserveKeyboardFocus })
    return true
  }
  const route = agentHubPeekSourceRoute(source)
  if (
    !agentHubPeekFileKind(filePath) ||
    !route ||
    (getConnectionIdForFile(source.worktreeId, filePath) === undefined &&
      !route.runtimeEnvironmentId)
  ) {
    return false
  }
  toast.info(
    translate(
      'agentHub.peek.workspaceFallback',
      'This preview is unavailable here. Opening in the workspace.'
    )
  )
  source.openInWorkspace()
  return true
}

/** A direct click in a mirror peeks instead of leaving the mirror for the workspace. */
export function peekTerminalUrlFromMirror(url: string, source: AgentHubPeekLinkSource): boolean {
  if (!peekEnabled(source) || (!source.previewOnModifier && mirrorKeyOf(source.event) === null)) {
    return false
  }
  if (
    getClientCreationActionPolicy(useAppStore.getState(), source.worktreeId)['managed-browser']
      .state !== 'enabled'
  ) {
    return false
  }
  if (!agentHubPeekSourceRoute(source)) {
    return false
  }
  openPeekUrlWithFeedback(url, source)
  return true
}

export function peekTerminalFileFromMirror(
  filePath: string,
  source: AgentHubPeekLinkSource
): boolean {
  return peekEnabled(source) && (source.previewOnModifier || mirrorKeyOf(source.event) !== null)
    ? openAgentHubPeekFile(filePath, source)
    : false
}

/** The "Peek" row of a link's action menu, in any terminal while Agent Hub is on. */
export function agentHubPeekUrlAction(
  url: string,
  source: AgentHubPeekLinkSource
): LinkAction | null {
  return peekEnabled(source) &&
    getClientCreationActionPolicy(useAppStore.getState(), source.worktreeId)['managed-browser']
      .state === 'enabled' &&
    agentHubPeekSourceRoute(source)
    ? {
        icon: PictureInPicture2,
        label: translate('agentHub.peek.action', 'Peek'),
        shortcut: source.previewOnModifier || mirrorKeyOf(source.event) !== null ? 'primary' : null,
        run: () => openPeekUrlWithFeedback(url, source)
      }
    : null
}

export function agentHubPeekFileAction(
  filePath: string,
  source: AgentHubPeekLinkSource
): LinkAction | null {
  const route =
    peekEnabled(source) && agentHubPeekFileKind(filePath) ? agentHubPeekSourceRoute(source) : null
  if (!route) {
    return null
  }
  return {
    icon: PictureInPicture2,
    label: translate('agentHub.peek.action', 'Peek'),
    shortcut:
      (source.previewOnModifier || mirrorKeyOf(source.event) !== null) &&
      (getConnectionIdForFile(source.worktreeId, filePath) !== undefined ||
        route.runtimeEnvironmentId)
        ? 'primary'
        : null,
    run: () => {
      openAgentHubPeekFile(filePath, source)
    }
  }
}
