import { useEffect, useRef } from 'react'
import { useAgentHubMirrorSelection } from './agent-hub-mirror-selection'
import { findAttachedAgentHubMirrorInput } from './agent-hub-mirror-input'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export function useAgentHubMirrorSelectionFocus({
  windowId,
  tabId,
  target,
  rootRef,
  allowed,
  preview
}: {
  windowId: string
  tabId: string
  target: AgentHubPaneTarget
  rootRef: React.RefObject<HTMLElement | null>
  allowed: boolean
  preview: boolean
}): void {
  const sourceTabId = target.tab.id
  const paneKey = target.paneKey
  const selection = useAgentHubMirrorSelection()
  const consumed = useRef(0)
  useEffect(() => {
    if (
      selection.seq === consumed.current ||
      selection.windowId !== windowId ||
      selection.tabId !== tabId
    ) {
      return
    }
    consumed.current = selection.seq
    if (!selection.focusTerminal || !allowed || !rootRef.current) {
      return
    }
    const root = rootRef.current
    const anchor = document.activeElement
    let cancelled = false
    let frame = 0
    const focus = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (cancelled || !root.isConnected) {
          return
        }
        const foreground = document.activeElement
        if (
          foreground !== anchor &&
          foreground instanceof HTMLElement &&
          foreground !== document.body &&
          !root.contains(foreground)
        ) {
          observer.disconnect()
          return
        }
        const input = preview
          ? Array.from(root.querySelectorAll<HTMLElement>('[data-agent-hub-preview-entry]'))
              .find((entry) => entry.dataset.agentHubPreviewEntry === tabId && !entry.hidden)
              ?.querySelector<HTMLElement>('.xterm-helper-textarea')
          : findAttachedAgentHubMirrorInput(root, { tab: { id: sourceTabId }, paneKey })
        if (input) {
          input.focus({ preventScroll: true })
          observer.disconnect()
        }
      })
    }
    const observer = new MutationObserver(focus)
    observer.observe(root, { childList: true, subtree: true })
    focus()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [selection, windowId, tabId, sourceTabId, paneKey, allowed, preview, rootRef])
}
