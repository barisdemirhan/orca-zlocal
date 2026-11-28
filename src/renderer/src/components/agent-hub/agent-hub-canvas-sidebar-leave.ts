import { isAgentHubMirrorTabClickBlocked } from './agent-hub-mirror-gesture'
// Where the user already is: the current workspace's card, or the current page's nav button.
// Going anywhere else changes the page or workspace, which leaves the canvas by itself.
// A bot's chats all live in its home workspace, so switching between them changes neither.
const CURRENT_DESTINATION =
  '[data-worktree-sidebar] [data-worktree-card-surface][data-worktree-card-active], [data-bot-sidebar-entry] [data-worktree-card-surface][data-worktree-card-active], [data-bot-sidebar-chat], [data-contextual-tour-target="sidebar-navigation"] [aria-current="page"]'
const NESTED_CONTROL = 'button, a, input, [role="button"], [role="menuitem"]'

/**
 * Whether a click in the left sidebar asks for the place the canvas is covering: a plain click
 * on the current workspace or page (not on a control inside its row, not a selection gesture).
 */
export function isAgentHubCanvasLeaveClick(
  event: Pick<MouseEvent, 'target' | 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>
): boolean {
  if (
    isAgentHubMirrorTabClickBlocked() ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false
  }
  const target = event.target
  if (!(target instanceof Element)) {
    return false
  }
  const destination = target.closest(CURRENT_DESTINATION)
  if (!destination) {
    return false
  }
  const control = target.closest(NESTED_CONTROL)
  return !control || control === destination || !destination.contains(control)
}
