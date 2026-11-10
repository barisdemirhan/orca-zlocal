import { focusNativeChatCover } from '@/components/terminal-pane/chat/native-chat-covered-pane'
import { getOverlayFocusOwners } from '../overlay-focus-ownership'
import type { ManagedPane } from './pane-manager-types'

/** The pane's parts this reads: overlays that mount into a pane's corner pass the same shape. */
export type OverlayFocusPane = Pick<ManagedPane, 'container'> & {
  terminal: Pick<ManagedPane['terminal'], 'focus'>
}

export function focusPanePreservingOverlays(pane: OverlayFocusPane): void {
  if (
    typeof document !== 'undefined' &&
    (document.activeElement?.matches('[data-worktree-sidebar][data-keyboard-navigation]') ||
      getOverlayFocusOwners(pane.container).length > 0)
  ) {
    return
  }
  if (focusNativeChatCover(pane)) {
    return
  }
  pane.terminal.focus()
}
