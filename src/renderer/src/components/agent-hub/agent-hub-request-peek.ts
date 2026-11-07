import { translate } from '@/i18n/i18n'
import { toast } from 'sonner'
import { agentHubPeekRefusalReason } from './agent-hub-peek-refusal'
import {
  joinAbsolutePath,
  normalizeAbsolutePath,
  resolveTildePath
} from '../../../../shared/file-links/file-link-path-normalization'
import {
  extractTerminalFileLinks,
  resolveTerminalFileLink
} from '../../../../shared/terminal/links/terminal-links'
import { getRelativePathInsideWorktree } from '@/runtime/runtime-file-routing'
import { getTerminalFileContext } from '../terminal-pane/host-files/terminal-file-path-mapping'
import { detectLanguage } from '@/lib/language-detect'
import { useAppStore } from '@/store'
import { openRoutedHttpLink } from '@/lib/browser/navigation/http-link-destinations'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'
import {
  agentHubPeekFileItem,
  openAgentHubPeekUrl,
  agentHubPeekFileKind,
  type AgentHubPeekLinkSource
} from './agent-hub-peek-routing'
import {
  closeAgentHubPeek,
  goBackAgentHubPeek,
  isAgentHubPeekHostMounted,
  openAgentHubPeek,
  readAgentHubPeek
} from './agent-hub-peek-store'
import { findWorktreeById } from '@/store/slices/worktree-helpers'
import { agentHubRequestHost } from './agent-hub-request-target'
import type {
  AgentHubPeekControlAction,
  AgentHubPeekOutcome,
  AgentHubPeekStatus
} from '../../../../shared/agent-hub-requests'

/** The Peek item on screen, only when it belongs to `host`: agents never see another host's page. */
function shownAgentHubPeekForHost(host: string) {
  const peek = readAgentHubPeek()
  const item = peek?.history[peek.index]
  if (!peek || !item) {
    return null
  }
  const state = useAppStore.getState()
  const worktree = findWorktreeById(state.worktreesByRepo, item.worktreeId)
  return worktree && agentHubRequestHost(state, worktree) === host ? { peek, item } : null
}

export function readAgentHubPeekStatus(host: string): AgentHubPeekStatus | null {
  const shown = shownAgentHubPeekForHost(host)
  return shown
    ? {
        title: shown.item.title.slice(0, 1_000),
        location: shown.item.location.slice(0, 4_096),
        canGoBack: shown.peek.index > 0
      }
    : null
}

export function executeAgentHubPeekControl(
  host: string,
  action: AgentHubPeekControlAction
): AgentHubPeekOutcome {
  const shown = shownAgentHubPeekForHost(host)
  if (!shown) {
    return 'nothing-open'
  }
  if (action === 'close') {
    closeAgentHubPeek()
    return 'closed'
  }
  if (shown.peek.index === 0) {
    return 'at-first-page'
  }
  goBackAgentHubPeek()
  return 'went-back'
}

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
  const exactLink = url
    ? null
    : extractTerminalFileLinks(link).find(
        (parsed) => parsed.startIndex === 0 && parsed.endIndex === link.length
      )
  const filePath = url
    ? null
    : ((exactLink ? resolveTerminalFileLink(exactLink, cwd)?.absolutePath : undefined) ??
      (/^~[\\/]/.test(link)
        ? resolveTildePath(link, cwd)
        : (normalizeAbsolutePath(link)?.normalized ?? joinAbsolutePath(cwd, link))))
  const relativePath = filePath
    ? getRelativePathInsideWorktree(target.worktree.path, filePath)
    : null
  if (!url && (!filePath || relativePath === null)) {
    throw new Error(
      translate(
        'auto.agentHubPeekOutsideWorkspace',
        'Agent Peek files must be inside the target workspace.'
      )
    )
  }
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
      } else if (filePath && relativePath !== null) {
        // A failed agent preview must not retry with the clicked-file access grant.
        useAppStore.getState().openFile({
          filePath,
          relativePath,
          worktreeId: target.worktree.id,
          language: detectLanguage(filePath),
          mode: 'edit',
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
  const item = filePath ? agentHubPeekFileItem(filePath, source) : null
  if (
    !item ||
    !filePath ||
    relativePath === null ||
    (item.content.kind !== 'web' && !item.content.readContext)
  ) {
    throw new Error(
      translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
    )
  }
  if (item.content.kind === 'web') {
    const context = getTerminalFileContext(
      target.worktree.id,
      target.worktree.path,
      host !== 'local' ? host : null
    )
    if (!context.sourceHostResolved) {
      throw new Error(
        translate(
          'agentHub.requests.peekUnsupported',
          'This URL or file cannot be opened in Peek on its host.'
        )
      )
    }
    // Agent HTML is read as workspace text rather than loading an unrestricted file URL.
    item.content = {
      kind: 'text',
      filePath,
      connectionId: null,
      readContext: {
        target: context.target,
        worktreeId: target.worktree.id,
        filePath,
        relativePath
      }
    }
  } else if (item.content.readContext) {
    const { access: _access, ...readContext } = item.content.readContext
    item.content = { ...item.content, readContext }
  }
  openAgentHubPeek({ ...item, preserveKeyboardFocus: true })
}
