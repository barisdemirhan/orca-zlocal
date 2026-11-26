import { webContents } from 'electron'
import { browserManager } from '../../guest-lifecycle/manager/browser-manager'
import { getBrowserExtensionSessionForProfile } from '../profile-sessions/browser-extension-session-loader'

/** Open browser pages in the profile's session, the active one first. */
function* browserPagesInProfileSession(
  profileId: string,
  activePageId: string | null
): Generator<string> {
  const sess = getBrowserExtensionSessionForProfile(profileId)
  if (!sess) {
    return
  }
  const pageIds = [
    ...(activePageId ? [activePageId] : []),
    ...browserManager.getWebContentsIdByTabId().keys()
  ]
  for (const pageId of pageIds) {
    const id = browserManager.getGuestWebContentsId(pageId)
    const contents = id === null ? undefined : webContents.fromId(id)
    if (contents && !contents.isDestroyed() && contents.session === sess) {
      yield pageId
    }
  }
}

/**
 * The workspace this profile's tabs were last used in: the active page's, else any open tab's.
 * Used only when no workspace is active, so an extension tab still has somewhere to go.
 */
export function recentWorktreeIdForBrowserProfile(
  profileId: string,
  activePageId: string | null
): string | undefined {
  for (const pageId of browserPagesInProfileSession(profileId, activePageId)) {
    const worktreeId = browserManager.getWorktreeIdForTab(pageId)
    if (worktreeId) {
      return worktreeId
    }
  }
  return undefined
}

/** A page of this profile's session to open a This-device tab beside; main has no workspace for it. */
export function recentClientHostedPageIdForBrowserProfile(
  profileId: string,
  activePageId: string | null
): string | undefined {
  return browserPagesInProfileSession(profileId, activePageId).next().value
}
