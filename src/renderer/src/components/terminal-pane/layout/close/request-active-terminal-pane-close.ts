import {
  REQUEST_ACTIVE_TERMINAL_PANE_CLOSE_EVENT,
  type RequestActiveTerminalPaneCloseDetail
} from '@/constants/terminal'

/**
 * Asks the mounted pane of `tabId` to close its active split (or `options.leafId`), with the usual
 * running-process confirmation unless `options.confirm` is false. Returns whether a mounted pane took it.
 */
export function requestActiveTerminalPaneClose(
  tabId: string,
  options?: { leafId?: string; confirm?: boolean }
): boolean {
  const detail: RequestActiveTerminalPaneCloseDetail = { tabId, ...options }
  window.dispatchEvent(
    new CustomEvent<RequestActiveTerminalPaneCloseDetail>(
      REQUEST_ACTIVE_TERMINAL_PANE_CLOSE_EVENT,
      { detail }
    )
  )
  return detail.handled === true
}

/** The mounted pane's side of `requestActiveTerminalPaneClose`. Returns the unsubscribe. */
export function onActiveTerminalPaneCloseRequest(
  tabId: string,
  closeActivePane: (request: { leafId?: string; confirm?: boolean }) => boolean | void
): () => void {
  const onRequest = (event: Event): void => {
    if (event instanceof CustomEvent && isCloseRequestFor(event.detail, tabId)) {
      const detail: RequestActiveTerminalPaneCloseDetail = event.detail
      if (closeActivePane({ leafId: detail.leafId, confirm: detail.confirm }) !== false) {
        detail.handled = true
      }
    }
  }
  window.addEventListener(REQUEST_ACTIVE_TERMINAL_PANE_CLOSE_EVENT, onRequest)
  return () => window.removeEventListener(REQUEST_ACTIVE_TERMINAL_PANE_CLOSE_EVENT, onRequest)
}

function isCloseRequestFor(
  detail: unknown,
  tabId: string
): detail is RequestActiveTerminalPaneCloseDetail {
  return (
    typeof detail === 'object' && detail !== null && 'tabId' in detail && detail.tabId === tabId
  )
}
