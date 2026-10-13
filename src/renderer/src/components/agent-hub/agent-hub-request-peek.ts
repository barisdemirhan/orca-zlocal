import { translate } from '@/i18n/i18n'
import { toast } from 'sonner'
import { agentHubPeekRefusalReason } from './agent-hub-peek-refusal'
import {
  joinAbsolutePath,
  normalizeAbsolutePath,
  resolveTildePath
} from '@/lib/terminal-path-normalization'
import { resolveTerminalFileLinkText } from '@/lib/terminal-links'
import { openDetectedFilePath } from '../terminal-pane/terminal-file-open-routing'
import { openRoutedHttpLink } from '@/lib/http-link-destinations'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  openAgentHubPeekFile,
  openAgentHubPeekUrl,
  agentHubPeekFileKind,
  type AgentHubPeekLinkSource
} from './agent-hub-peek-routing'
import { isAgentHubPeekHostMounted } from './agent-hub-peek-store'

export async function executeAgentHubPeek(
  host: string,
  link: string,
  target: AgentHubPaneTarget
): Promise<void> {
  if (!isAgentHubPeekHostMounted()) {
    throw new Error(
      translate('agentHub.requests.peekUnavailable', 'Peek is unavailable in the current view.')
    )
  }
  const url = /^https?:\/\//i.test(link)
  const cwd = target.tab.startupCwd ?? target.worktree.path
  if (
    !url &&
    /^[a-z][a-z\d+.-]*:/i.test(link) &&
    !normalizeAbsolutePath(link) &&
    !link.startsWith('file://')
  ) {
    throw new Error(
      translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
    )
  }
  const filePath = url
    ? null
    : (resolveTerminalFileLinkText(link, cwd)?.absolutePath ??
      normalizeAbsolutePath(link)?.normalized ??
      resolveTildePath(link, cwd) ??
      joinAbsolutePath(cwd, link))
  const source: AgentHubPeekLinkSource = {
    worktreeId: target.worktree.id,
    worktreePath: target.worktree.path,
    onPairedRuntime: host !== 'local',
    ...(host !== 'local'
      ? { sourceOwner: { kind: 'runtime' as const, runtimeEnvironmentId: host } }
      : {}),
    event: undefined,
    openInWorkspace: () => {
      if (url) {
        openRoutedHttpLink(link, {
          worktreeId: target.worktree.id,
          sourceOwner: source.sourceOwner,
          forceDestination: 'orca'
        })
      } else if (filePath) {
        openDetectedFilePath(filePath, null, null, {
          worktreeId: target.worktree.id,
          worktreePath: target.worktree.path,
          runtimeEnvironmentId: host !== 'local' ? host : null
        })
      }
    },
    openExternally: url
      ? () => {
          void window.api.shell.openUrl(link)
        }
      : null
  }
  if (url) {
    await openAgentHubPeekUrl(link, source, true)
    return
  }
  if (filePath && !agentHubPeekFileKind(filePath)) {
    const reason = agentHubPeekRefusalReason(filePath)
    toast.error(reason)
    throw new Error(reason)
  }
  if (!filePath || !openAgentHubPeekFile(filePath, source, true)) {
    throw new Error(
      translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
    )
  }
}
