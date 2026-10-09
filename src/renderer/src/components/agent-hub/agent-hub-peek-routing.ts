import { translate } from '@/i18n/i18n'
import type { LinkAction } from '@/components/link-actions/link-action-request'
import { absolutePathToFileUri } from '@/components/editor/markdown-internal-links'
import { getConnectionIdForFile } from '@/lib/connection-context'
import { useAppStore } from '@/store'
import { agentHubMirrorWindowIdOf } from './agent-hub-mirror-element'
import {
  isAgentHubPeekHostMounted,
  openAgentHubPeek,
  type AgentHubPeekItem
} from './agent-hub-peek-store'

/** Where a terminal link was clicked, and the ways out it already had before Peek. */
export type AgentHubPeekLinkSource = {
  worktreeId: string
  /** False for SSH and paired-runtime sources: Peek reads and browses on this machine only. */
  local: boolean
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
    source.local &&
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

export function agentHubPeekUrlItem(url: string, source: AgentHubPeekLinkSource): AgentHubPeekItem {
  return {
    content: { kind: 'web', url },
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
  // Why null and not falsy: undefined means the owner has not loaded, which is not "local".
  if (getConnectionIdForFile(source.worktreeId, filePath) !== null) {
    return null
  }
  return {
    content:
      kind === 'html' ? { kind: 'web', url: absolutePathToFileUri(filePath) } : { kind, filePath },
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
    ? { label: translate('agentHub.peek.action', 'Peek'), run: () => openAgentHubPeek(item) }
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
