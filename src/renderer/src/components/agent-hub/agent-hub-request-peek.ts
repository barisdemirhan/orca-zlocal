import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  joinAbsolutePath,
  normalizeAbsolutePath,
  resolveTildePath
} from '@/lib/terminal-path-normalization'
import { resolveTerminalFileLinkText } from '@/lib/terminal-links'
import { openDetectedFilePath } from '../terminal-pane/terminal-file-open-routing'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubPeekFileItem,
  agentHubPeekUrlItem,
  type AgentHubPeekLinkSource
} from './agent-hub-peek-routing'
import { isAgentHubPeekHostMounted, openAgentHubPeek } from './agent-hub-peek-store'

export function executeAgentHubPeek(host: string, link: string, target: AgentHubPaneTarget): void {
  if (host !== 'local') {
    throw new Error(
      translate(
        'agentHub.requests.pairedPeekUnavailable',
        'Peek cannot open URLs or files from this paired host yet.'
      )
    )
  }
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
    onPairedRuntime: false,
    event: undefined,
    openInWorkspace: () => {
      if (url) {
        useAppStore.getState().createBrowserTab(target.worktree.id, link, { activate: true })
      } else if (filePath) {
        openDetectedFilePath(filePath, null, null, {
          worktreeId: target.worktree.id,
          worktreePath: target.worktree.path
        })
      }
    },
    openExternally: url
      ? () => {
          void window.api.shell.openUrl(link)
        }
      : null
  }
  const item = url
    ? agentHubPeekUrlItem(link, source)
    : filePath
      ? agentHubPeekFileItem(filePath, source)
      : null
  if (!item) {
    throw new Error(
      translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
    )
  }
  openAgentHubPeek({ ...item, preserveKeyboardFocus: true })
}
