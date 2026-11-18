import { useAppStore } from '@/store'
import { createWebRuntimeSessionBrowserTab } from '@/runtime/browser/creation/web-runtime-browser-creation'
import type { BrowserClientHostedRemoteChoice } from '@/components/settings/browser/routing/browser-client-hosted-remote-copy'
import { resolveBrowserReopenOnServerUrl } from './navigate/reopen-on-server/browser-reopen-on-server'

/**
 * Moves a remote-runtime page to the other channel. Placement is fixed per page, so this opens a
 * new page at the last address and closes the old one only once the new one exists.
 */
export async function switchBrowserPageChannel(args: {
  environmentId: string
  worktreeId: string
  pageId: string
  lastCommittedUrl: string | null | undefined
  channel: BrowserClientHostedRemoteChoice
}): Promise<boolean> {
  const created = await createWebRuntimeSessionBrowserTab({
    worktreeId: args.worktreeId,
    environmentId: args.environmentId,
    url: resolveBrowserReopenOnServerUrl(args.lastCommittedUrl),
    // Why auto for this device: the main process still checks the host can lend its network.
    placementPreference: args.channel === 'server' ? 'server' : 'auto',
    focusOnCreate: true
  })
  if (created) {
    useAppStore.getState().closeBrowserPage(args.pageId)
  }
  return created
}
