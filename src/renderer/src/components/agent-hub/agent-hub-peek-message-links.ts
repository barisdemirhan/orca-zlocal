import { openRoutedHttpLink } from '@/lib/browser/navigation/http-link-destinations'
import {
  extractTerminalFileLinks,
  resolveTerminalFileLink
} from '../../../../shared/terminal/links/terminal-links'
import { extractTerminalHttpLinks } from '../../../../shared/terminal/links/terminal-http-url-extraction'
import { openDetectedFilePath } from '../terminal-pane/links/files/terminal-file-open-routing'
import type { Worktree } from '../../../../shared/worktree/types'
import { agentHubPeekFileItem, agentHubPeekUrlItem } from './agent-hub-peek-routing'
import type { AgentHubPeekItem } from './agent-hub-peek-store'

const MAX_MESSAGE_PEEKS = 4

/**
 * The pages and peekable files an agent's message points to, found with the terminal's own link
 * rules, so a card offers what a click in its terminal would.
 */
export function agentHubPeekItemsInMessage(text: string, worktree: Worktree): AgentHubPeekItem[] {
  const onPairedRuntime = (worktree.hostId ?? '').startsWith('runtime:')
  const items: AgentHubPeekItem[] = []
  const seen = new Set<string>()
  const add = (item: AgentHubPeekItem | null): void => {
    if (item && !seen.has(item.location)) {
      seen.add(item.location)
      items.push(item)
    }
  }
  for (const link of extractTerminalHttpLinks(text)) {
    add(
      agentHubPeekUrlItem(link.url, {
        worktreeId: worktree.id,
        onPairedRuntime,
        event: undefined,
        openInWorkspace: () =>
          openRoutedHttpLink(link.url, { worktreeId: worktree.id, modifierHeld: false }),
        openExternally: () =>
          openRoutedHttpLink(link.url, {
            worktreeId: worktree.id,
            modifierHeld: false,
            forceDestination: 'system'
          })
      })
    )
  }
  const deps = { worktreeId: worktree.id, worktreePath: worktree.path }
  for (const parsed of extractTerminalFileLinks(text)) {
    // Why: the terminal confirms a candidate exists before linking it; a message cannot, and a
    // candidate with spaces is usually words run together ("a.ts and b.pdf").
    if (/\s/.test(parsed.pathText)) {
      continue
    }
    const resolved = resolveTerminalFileLink(parsed, worktree.path)
    if (resolved) {
      const filePath = resolved.absolutePath
      add(
        agentHubPeekFileItem(filePath, {
          worktreeId: worktree.id,
          worktreePath: worktree.path,
          onPairedRuntime,
          line: resolved.line,
          column: resolved.column,
          event: undefined,
          openInWorkspace: () =>
            openDetectedFilePath(filePath, resolved.line, resolved.column, deps),
          openExternally: () =>
            openDetectedFilePath(filePath, resolved.line, resolved.column, {
              ...deps,
              openWithSystemDefault: true
            })
        })
      )
    }
  }
  const priority = (item: AgentHubPeekItem): number =>
    ['web', 'image', 'pdf', 'markdown'].includes(item.content.kind) ? 0 : 1
  return items
    .sort((first, second) => priority(first) - priority(second))
    .slice(0, MAX_MESSAGE_PEEKS)
}
