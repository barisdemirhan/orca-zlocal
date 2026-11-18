import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import BrowserPane from '../browser-pane/BrowserPane'
import { DeferredBrowserContent } from '../browser-pane/assemble-chrome/DeferredBrowserContent'
import { registerBrowserOverlaySlotViewport } from '../browser-pane/host-guest/viewport/browser-page-viewport'
import { createWorkspaceClientBrowserTab } from '@/lib/workspace-client-browser-tab'
import { resolveLocalhostHttpLinkDisplayUrl } from '@/lib/browser/navigation/http-link-routing'
import { AGENT_HUB_PEEK_WORKTREE_ID } from '../../../../shared/agent-hub-peek-workspace'
import { closeAgentHubPeekBrowserTab } from './agent-hub-peek-pages'
import { isAgentHubPeekNameReachableHere } from './agent-hub-peek-browser-route'

export { closeLeftoverAgentHubPeekPages } from './agent-hub-peek-pages'

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
  routeHostId,
  routingWorktreeId,
  resolveNameHere,
  onUnavailable,
  onOpenPage
}: {
  url: string
  /** Loads through this machine, as the workspace's own browser tabs do (an SSH host's localhost). */
  hostId: ExecutionHostId
  routeHostId?: ExecutionHostId
  routingWorktreeId?: string
  /** A host's private name: falls back unless this device resolves it to that machine. */
  resolveNameHere?: boolean
  onUnavailable: () => void
  /** A link the page opened in a new tab or window; Peek shows it next. */
  onOpenPage: (url: string) => void
}): React.JSX.Element | null {
  const [tabId, setTabId] = useState<string | null>(null)
  const ownTabs = useRef(new Set<string>())
  const creating = useRef(false)
  useEffect(() => {
    const owned = ownTabs.current
    let live = true
    let createdTabId: string | null = null
    void (async () => {
      if (resolveNameHere && !(await isAgentHubPeekNameReachableHere(url))) {
        if (live) {
          onUnavailable()
        }
        return
      }
      const displayUrl =
        hostId === 'local' ? await resolveLocalhostHttpLinkDisplayUrl(url, { kind: 'local' }) : null
      if (!live) {
        return
      }
      // WHY: creation notifies subscribers before this component knows its own tab id.
      creating.current = true
      try {
        const tab = createWorkspaceClientBrowserTab(
          useAppStore.getState(),
          {
            workspaceId: AGENT_HUB_PEEK_WORKTREE_ID,
            url: displayUrl ?? url,
            focusOnCreate: false
          },
          hostId
        )
        createdTabId = tab.id
        owned.add(tab.id)
        setTabId(tab.id)
      } finally {
        creating.current = false
      }
    })().catch(() => {
      if (live) {
        onUnavailable()
      }
    })
    return () => {
      live = false
      if (createdTabId) {
        owned.delete(createdTabId)
        closeAgentHubPeekBrowserTab(createdTabId)
      }
    }
  }, [url, hostId, resolveNameHere, onUnavailable])
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
          closeAgentHubPeekBrowserTab(tab.id)
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
          routingWorktreeId={routingWorktreeId}
          sourceExecutionHostId={routeHostId ?? hostId}
        />
      </DeferredBrowserContent>
    </div>
  )
}
