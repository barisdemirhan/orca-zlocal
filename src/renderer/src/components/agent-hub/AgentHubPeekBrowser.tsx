import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import BrowserPane from '../browser-pane/BrowserPane'
import { DeferredBrowserContent } from '../browser-pane/assemble-chrome/DeferredBrowserContent'
import { registerBrowserOverlaySlotViewport } from '../browser-pane/host-guest/browser-page-viewport'

/**
 * Peek's pages are browser tabs of a workspace no layout renders, so no tab strip lists them and
 * no overlay mounts them a second time; Peek is their only surface.
 */
export const AGENT_HUB_PEEK_WORKTREE_ID = 'agent-hub-peek'

/** Closes pages a previous Peek left behind, e.g. when Orca quit with one open. */
export function closeLeftoverAgentHubPeekPages(): void {
  const state = useAppStore.getState()
  for (const tab of state.browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID] ?? []) {
    state.closeBrowserTab(tab.id, { reason: 'cleanup' })
  }
}

function peekPageUrl(tabId: string): string | null {
  const state = useAppStore.getState()
  const tab = state.browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]?.find(
    (entry) => entry.id === tabId
  )
  const page = state.browserPagesByWorkspace[tabId]?.find(
    (entry) => entry.id === (tab?.activePageId ?? tabId)
  )
  return page?.url ?? null
}

/** A page in Orca's own browser (its chrome, session and profiles), shown inside Peek. */
export function AgentHubPeekBrowser({
  url,
  hostId,
  onOpenPage
}: {
  url: string
  /** Loads through this machine, as the workspace's own browser tabs do (an SSH host's localhost). */
  hostId: ExecutionHostId
  /** A link the page opened in a new tab or window; Peek shows it next. */
  onOpenPage: (url: string) => void
}): React.JSX.Element | null {
  const [tabId, setTabId] = useState<string | null>(null)
  const ownTabs = useRef(new Set<string>())
  const creating = useRef(false)
  useEffect(() => {
    const owned = ownTabs.current
    const state = useAppStore.getState()
    // Why: the store notifies subscribers inside createBrowserTab, before its id is known here.
    creating.current = true
    const tab = state.createBrowserTab(AGENT_HUB_PEEK_WORKTREE_ID, url, {
      activate: false,
      browserRuntimeEnvironmentId: null,
      executionHostId: hostId,
      sessionProfileId:
        state.defaultBrowserSessionProfileIdByHostId[hostId] ?? state.defaultBrowserSessionProfileId
    })
    creating.current = false
    owned.add(tab.id)
    setTabId(tab.id)
    return () => {
      owned.delete(tab.id)
      useAppStore.getState().closeBrowserTab(tab.id, { reason: 'cleanup' })
    }
  }, [url, hostId])
  const onOpenPageRef = useRef(onOpenPage)
  useLayoutEffect(() => {
    onOpenPageRef.current = onOpenPage
  })
  // Why: a page's new tab lands in its own (unrendered) workspace, where it would go unseen.
  useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        const tabs = state.browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]
        if (
          creating.current ||
          tabs === previous.browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]
        ) {
          return
        }
        for (const tab of tabs ?? []) {
          if (ownTabs.current.has(tab.id)) {
            continue
          }
          const opened = peekPageUrl(tab.id)
          state.closeBrowserTab(tab.id, { reason: 'cleanup' })
          if (opened && opened !== 'about:blank') {
            onOpenPageRef.current(opened)
          }
        }
      }),
    []
  )
  const browserTab = useAppStore((state) =>
    tabId
      ? (state.browserTabsByWorktree[AGENT_HUB_PEEK_WORKTREE_ID]?.find((tab) => tab.id === tabId) ??
        null)
      : null
  )
  // Why: the page's guest lives under this viewport, as under a workspace's overlay slot.
  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      if (tabId) {
        registerBrowserOverlaySlotViewport(tabId, node)
      }
    },
    [tabId]
  )
  if (!browserTab) {
    return null
  }
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-agent-hub-peek-browser
      // Why: chrome chords (find, address bar) answer here only while focus is inside Peek.
      data-browser-overlay-tab-id={browserTab.id}
    >
      <div ref={setViewport} className="absolute inset-0 flex min-h-0 flex-col" />
      <DeferredBrowserContent mountEligible>
        <BrowserPane
          browserTab={browserTab}
          isActive
          isWorktreeActive
          chromeShortcutScope="owned-target"
        />
      </DeferredBrowserContent>
    </div>
  )
}
