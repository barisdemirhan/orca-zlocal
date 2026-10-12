import { translate } from '@/i18n/i18n'
import type { LinkAction } from '@/components/link-actions/link-action-request'
import { PictureInPicture2 } from 'lucide-react'
import { absolutePathToFileUri } from '@/components/editor/markdown-internal-links'
import { getConnectionIdForFile } from '@/lib/connection-context'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'
import { resolveWorktreeOperationRoute } from '@/lib/worktree-operation-route'
import { useAppStore } from '@/store'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import { agentHubMirrorWindowIdOf } from './agent-hub-mirror-element'
import {
  isAgentHubPeekHostMounted,
  openAgentHubPeek,
  type AgentHubPeekItem
} from './agent-hub-peek-store'

/** Where a terminal link was clicked, and the ways out it already had before Peek. */
export type AgentHubPeekLinkSource = {
  worktreeId: string
  /** A paired runtime's (or an unknown) terminal; Peek leaves its links to Orca's own routing. */
  onPairedRuntime: boolean
  event: MouseEvent | undefined
  openInWorkspace: () => void
  openExternally: (() => void) | null
}

const FILE_KINDS: readonly [RegExp, 'image' | 'pdf' | 'media' | 'html'][] = [
  [/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i, 'image'],
  [/\.pdf$/i, 'pdf'],
  [/\.(mp4|mov|m4v|webm|mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i, 'media'],
  [/\.html?$/i, 'html']
]

export function agentHubPeekFileKind(filePath: string): 'image' | 'pdf' | 'media' | 'html' | null {
  return FILE_KINDS.find(([pattern]) => pattern.test(filePath))?.[1] ?? null
}

function peekEnabled(source: AgentHubPeekLinkSource): boolean {
  return (
    !source.onPairedRuntime &&
    useAppStore.getState().settings?.experimentalAgentHub === true &&
    isAgentHubPeekHostMounted()
  )
}

function mirrorKeyOf(event: MouseEvent | undefined): string | null {
  return event?.target instanceof Element ? agentHubMirrorWindowIdOf(event.target) : null
}

function urlTitle(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}` || url
  } catch {
    return url
  }
}

/**
 * The machine a workspace's browser tabs load through (this Mac, or its SSH host, where an agent's
 * localhost lives), under the same rules a workspace browser tab follows; null where those rules
 * offer no client tab (a paired runtime, or the browser turned off for it).
 */
export function agentHubPeekBrowserHost(worktreeId: string): ExecutionHostId | null {
  const state = useAppStore.getState()
  if (getClientCreationActionPolicy(state, worktreeId)['managed-browser'].state !== 'enabled') {
    return null
  }
  const route = resolveWorktreeOperationRoute(state, worktreeId)
  if (!route || route.runtimeEnvironmentId?.trim()) {
    return null
  }
  const host = parseExecutionHostId(route.executionHostId)
  return host && host.kind !== 'runtime' ? host.id : null
}

export function agentHubPeekUrlItem(
  url: string,
  source: AgentHubPeekLinkSource
): AgentHubPeekItem | null {
  const hostId = agentHubPeekBrowserHost(source.worktreeId)
  if (!hostId) {
    return null
  }
  return {
    content: { kind: 'web', url, hostId },
    worktreeId: source.worktreeId,
    title: urlTitle(url),
    location: url,
    mirrorKey: mirrorKeyOf(source.event),
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
  const connectionId = getConnectionIdForFile(source.worktreeId, filePath)
  // Why: undefined means the owner has not loaded yet, which is neither local nor a known host.
  if (connectionId === undefined) {
    return null
  }
  let content: AgentHubPeekItem['content']
  if (kind === 'html') {
    // Why local only: a file:// page loads from this disk, which a remote host's file is not on.
    if (connectionId !== null) {
      return null
    }
    content = { kind: 'web', url: absolutePathToFileUri(filePath), hostId: 'local' }
  } else {
    content = { kind, filePath, connectionId }
  }
  return {
    content,
    worktreeId: source.worktreeId,
    title: filePath.split(/[/\\]/).pop() || filePath,
    location: filePath,
    mirrorKey: mirrorKeyOf(source.event),
    openInWorkspace: source.openInWorkspace,
    openExternally: source.openExternally
  }
}

function openIfPeekable(item: AgentHubPeekItem | null): boolean {
  if (!item) {
    return false
  }
  openAgentHubPeek(item)
  return true
}

function peekAction(item: AgentHubPeekItem | null): LinkAction | null {
  return item
    ? {
        icon: PictureInPicture2,
        label: translate('agentHub.peek.action', 'Peek'),
        run: () => openAgentHubPeek(item)
      }
    : null
}

/** A direct click in a mirror peeks instead of leaving the mirror for the workspace. */
export function peekTerminalUrlFromMirror(url: string, source: AgentHubPeekLinkSource): boolean {
  return peekEnabled(source) && mirrorKeyOf(source.event) !== null
    ? openIfPeekable(agentHubPeekUrlItem(url, source))
    : false
}

export function peekTerminalFileFromMirror(
  filePath: string,
  source: AgentHubPeekLinkSource
): boolean {
  return peekEnabled(source) && mirrorKeyOf(source.event) !== null
    ? openIfPeekable(agentHubPeekFileItem(filePath, source))
    : false
}

/** The "Peek" row of a link's action menu, in any terminal while Agent Hub is on. */
export function agentHubPeekUrlAction(
  url: string,
  source: AgentHubPeekLinkSource
): LinkAction | null {
  return peekEnabled(source) ? peekAction(agentHubPeekUrlItem(url, source)) : null
}

export function agentHubPeekFileAction(
  filePath: string,
  source: AgentHubPeekLinkSource
): LinkAction | null {
  return peekEnabled(source) ? peekAction(agentHubPeekFileItem(filePath, source)) : null
}
