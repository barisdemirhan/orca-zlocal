import { translate } from '@/i18n/i18n'
import { openRoutedHttpLink } from '@/lib/browser/navigation/http-link-destinations'
import { resolveWorkspaceDirectory } from '@/lib/workspace/paths/workspace-directory'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { resolveMarkdownLinkTarget } from '../editor/markdown/link-routing/markdown-internal-links'
import { resolveMarkdownPreviewHref } from '../editor/markdown/link-routing/markdown-preview-links'
import { openDetectedFilePath } from '../terminal-pane/links/files/terminal-file-open-routing'
import { agentHubPeekSourceRoute } from './agent-hub-peek-browser-route'
import {
  agentHubPeekFileItem,
  agentHubPeekFileKind,
  agentHubPeekUrlItem,
  openAgentHubPeekUrl,
  type AgentHubPeekLinkSource
} from './agent-hub-peek-routing'
import {
  closeAgentHubPeek,
  openAgentHubPeek,
  peekReadRuntimeEnvironmentId,
  type AgentHubPeekItem
} from './agent-hub-peek-store'

/** Returns false for links the Markdown viewer handles itself, including same-page anchors. */
export function openAgentHubPeekMarkdownLink(item: AgentHubPeekItem, href: string): boolean {
  if (item.content.kind !== 'markdown' && item.content.kind !== 'notebook') {
    return false
  }
  const content = item.content
  const runtimeEnvironmentId = peekReadRuntimeEnvironmentId(content.readContext)
  const source: AgentHubPeekLinkSource = {
    worktreeId: item.worktreeId,
    onPairedRuntime: runtimeEnvironmentId !== null,
    sourceOwner: runtimeEnvironmentId
      ? { kind: 'runtime', runtimeEnvironmentId }
      : content.connectionId
        ? { kind: 'ssh', connectionId: content.connectionId }
        : { kind: 'local' },
    event: undefined,
    openInWorkspace: item.openInWorkspace,
    openExternally: null
  }
  const route = agentHubPeekSourceRoute(source)
  const worktreePath = resolveWorkspaceDirectory(
    useAppStore.getState(),
    item.worktreeId,
    route?.executionHostId
  )
  const target = resolveMarkdownLinkTarget(href, content.filePath, worktreePath)
  if (!target || target.kind === 'anchor') {
    return false
  }
  if (target.kind === 'external') {
    source.openInWorkspace = () =>
      openRoutedHttpLink(target.url, {
        worktreeId: item.worktreeId,
        sourceOwner: source.sourceOwner
      })
    source.openExternally = () =>
      openRoutedHttpLink(target.url, {
        worktreeId: item.worktreeId,
        sourceOwner: source.sourceOwner,
        forceDestination: 'system'
      })
    const next = agentHubPeekUrlItem(target.url, source)
    if (next) {
      openAgentHubPeek({ ...next, mirrorKey: item.mirrorKey })
    } else {
      void openAgentHubPeekUrl(target.url, source).catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : translate('agentHub.peek.unavailable', 'This link could not be opened.')
        )
      )
    }
    return true
  }
  const resolved = resolveMarkdownPreviewHref(href, content.filePath)
  if (target.absolutePath === content.filePath && resolved?.hash) {
    return false
  }
  if (!worktreePath || !route) {
    return false
  }
  const deps = { worktreeId: item.worktreeId, worktreePath, runtimeEnvironmentId }
  source.worktreePath = worktreePath
  source.openInWorkspace = () =>
    openDetectedFilePath(target.absolutePath, target.line ?? null, target.column ?? null, deps)
  source.openExternally = () =>
    openDetectedFilePath(target.absolutePath, target.line ?? null, target.column ?? null, {
      ...deps,
      openWithSystemDefault: true
    })
  const next =
    agentHubPeekFileKind(target.absolutePath) === 'markdown'
      ? agentHubPeekFileItem(target.absolutePath, source)
      : null
  if (next && next.content.kind === 'markdown') {
    openAgentHubPeek({
      ...next,
      mirrorKey: item.mirrorKey,
      content: { ...next.content, initialAnchor: resolved?.hash.slice(1) || null }
    })
  } else {
    closeAgentHubPeek()
    source.openInWorkspace()
  }
  return true
}
