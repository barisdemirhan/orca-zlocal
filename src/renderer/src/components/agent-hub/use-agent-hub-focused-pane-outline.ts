import { useEffect } from 'react'

/** Switches the focused-pane outline (a CSS rule keyed on this attribute) on for the whole app. */
export function useAgentHubFocusedPaneOutline(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    document.documentElement.dataset.agentHubFocusedPaneOutline = ''
    return () => {
      delete document.documentElement.dataset.agentHubFocusedPaneOutline
    }
  }, [enabled])
}
