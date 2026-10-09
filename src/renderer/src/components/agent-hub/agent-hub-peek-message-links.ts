import { openRoutedHttpLink } from '@/lib/http-link-destinations'
import { extractTerminalFileLinks, resolveTerminalFileLink } from '@/lib/terminal-links'
import { extractTerminalHttpLinks } from '../terminal-pane/terminal-http-url-extraction'
import { openDetectedFilePath } from '../terminal-pane/terminal-file-open-routing'
import type { Worktree } from '../../../../shared/worktree/types'
import { agentHubPeekFileItem, agentHubPeekUrlItem } from './agent-hub-peek-routing'
import type { AgentHubPeekItem } from './agent-hub-peek-store'

const MAX_MESSAGE_PEEKS = 4

/**
 * The pages and peekable files an agent's message points to, found with the terminal's own link
 * rules, so a card offers what a click in its terminal would.
 */
export function agentHubPeekItemsInMessage(text: string, worktree: Worktree): AgentHubPeekItem[] {
  const local = (worktree.hostId ?? 'local') === 'local'
  const items: AgentHubPeekItem[] = []
  const seen = new Set<string>()
  const add = (item: AgentHubPeekItem | null): void => {
    if (item && !seen.has(item.location) && items.length < MAX_MESSAGE_PEEKS) {
      seen.add(item.location)
      items.push(item)
    }
  }
  for (const link of extractTerminalHttpLinks(text)) {
    add(
      agentHubPeekUrlItem(link.url, {
        worktreeId: worktree.id,
        local,
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
          local,
          event: undefined,
          openInWorkspace: () => openDetectedFilePath(filePath, null, null, deps),
          openExternally: () =>
            openDetectedFilePath(filePath, null, null, { ...deps, openWithSystemDefault: true })
        })
      )
    }
  }
  return items
}
