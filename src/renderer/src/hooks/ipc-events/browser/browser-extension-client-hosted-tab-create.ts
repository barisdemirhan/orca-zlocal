import {
  isClientHostedBrowserSourcePage,
  openClientHostedUrlBesideBrowserPage
} from '@/lib/browser/palette/open-client-hosted-link-beside-page'
import { useAppStore } from '../../../store/index'
import type { BrowserTabCreateRequest } from '../../../../../shared/browser/workspaces/browser-tab-create-request'
import { findBrowserTabWorktreeId } from './browser-request-workspace-owner'

// A This-device page has no workspace main knows; open beside it through its paired host, then answer with the local page id main registers.
export function openExtensionTabBesideClientHostedPage(
  store: ReturnType<typeof useAppStore.getState>,
  data: BrowserTabCreateRequest
): void {
  const sourcePageId = data.clientHostedSourcePageId!
  const worktreeId = findBrowserTabWorktreeId(store, sourcePageId)
  const fail = (error: unknown): void =>
    window.api.ui.replyTabCreate({
      requestId: data.requestId,
      error: error instanceof Error ? error.message : 'Tab creation failed'
    })
  if (!worktreeId || !isClientHostedBrowserSourcePage(sourcePageId)) {
    fail(new Error('The page this extension runs on is no longer open'))
    return
  }
  const environmentId = store.remoteBrowserPageHandlesByPageId[sourcePageId]?.environmentId
  openClientHostedUrlBesideBrowserPage({
    sourcePageId,
    worktreeId,
    url: data.url,
    activate: data.activate === true,
    onOpened: (remotePageId) => {
      const localPageId = Object.entries(
        useAppStore.getState().remoteBrowserPageHandlesByPageId
      ).find(
        ([, handle]) =>
          handle.remotePageId === remotePageId &&
          (!environmentId || handle.environmentId === environmentId)
      )?.[0]
      if (!localPageId) {
        fail(new Error('The new tab did not finish opening'))
        return
      }
      window.api.ui.replyTabCreate({ requestId: data.requestId, browserPageId: localPageId })
    },
    onFailed: fail
  })
}
