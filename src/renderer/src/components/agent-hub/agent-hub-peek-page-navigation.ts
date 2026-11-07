import { translate } from '@/i18n/i18n'
import { openWorkspaceBrowserTab } from '@/lib/browser/workspace/workspace-browser-tab-open'
import { toast } from 'sonner'
import type { AgentHubPeekItem } from './agent-hub-peek-store'

export function agentHubPeekPageTitle(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}` || url
  } catch {
    return url
  }
}

/** A popup follows the browser already hosting it, including a forwarded local origin. */
export function agentHubPeekPageItem(item: AgentHubPeekItem, url: string): AgentHubPeekItem | null {
  if (item.content.kind !== 'web') {
    return null
  }
  return {
    ...item,
    content: { ...item.content, url },
    title: agentHubPeekPageTitle(url),
    location: url,
    openInWorkspace: () => {
      void openWorkspaceBrowserTab({
        workspaceId: item.worktreeId,
        url,
        intent: { kind: 'url' }
      }).catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : translate('agentHub.peek.unavailable', 'This link could not be opened.')
        )
      )
    },
    openExternally: () => {
      void window.api.shell.openUrl(url)
    }
  }
}
