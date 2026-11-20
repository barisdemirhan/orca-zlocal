/**
 * What a pointer-down inside a mirror window should select, or null when the pane is already
 * selected and the click only hit its chrome.
 */
export function agentHubMirrorPointerSelection(
  element: HTMLElement | null,
  alreadyActive: boolean
): { focusTerminal: boolean } | null {
  const inTerminal = element?.closest('.xterm') != null
  // Why: the pane's own chrome (split, close, rename) renders only while the pane is
  // active; re-selecting it without terminal focus unmounts the button mid-click.
  if (!inTerminal && element?.closest('[data-agent-hub-mirror-slot]') != null) {
    if (alreadyActive) {
      return null
    }
    return {
      focusTerminal: element.closest('input, textarea, [contenteditable="true"]') == null
    }
  }
  return { focusTerminal: inTerminal }
}
