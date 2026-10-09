import { focusNativeChatCover } from '@/components/terminal-pane/native-chat-covered-pane'
import { hasVisibleOverlay } from '../visible-overlay'
import type { ManagedPane } from './pane-manager-types'

/** The pane's parts this reads: overlays that mount into a pane's corner pass the same shape. */
export type OverlayFocusPane = Pick<ManagedPane, 'container'> & {
  terminal: Pick<ManagedPane['terminal'], 'focus'>
}

export function focusPanePreservingOverlays(pane: OverlayFocusPane): void {
  if (
    typeof document !== 'undefined' &&
    (document.activeElement?.matches('[data-worktree-sidebar][data-keyboard-navigation]') ||
      hasVisibleOverlay({
        ignoreMatches: '[role="listbox"][data-worktree-sidebar]',
        ignoreContaining: pane.container,
        ignoreDismissed: true
      }))
  ) {
    return
  }
  if (focusNativeChatCover(pane)) {
    return
  }
  pane.terminal.focus()
}
